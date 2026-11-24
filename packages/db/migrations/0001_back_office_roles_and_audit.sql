-- Back office foundation (docs/specs/back-office.md, ADR-0010): roles, the audit log, overrides.
-- Every permission is checked here in the database, never only in the admin pages:
--   * every back-office action needs a signed-in user WITH MFA (aal2 in the token);
--   * roles live in admin_roles and change only through grant_role / revoke_role;
--   * owners grant roles below owner; only a super admin grants owner or super admin;
--   * there is always at least one super admin (after the first one is set up);
--   * the audit log is insert-only, for everyone, the service role included.

create type public.admin_role as enum (
  'super_admin',
  'owner',
  'content_editor',
  'reviewer',
  'build_tester',
  'translator',
  'competition_manager',
  'judge',
  'moderator',
  'coach_verifier',
  'shop_manager',
  'communications',
  'support',
  'data_protection_officer'
);

create table public.admin_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  action text not null check (action ~ '^[a-z]+(\.[a-z_]+)+$'),
  target text,
  before jsonb,
  after jsonb,
  -- Set only for super-admin overrides: why the normal check was skipped.
  override_reason text check (override_reason is null or length(btrim(override_reason)) >= 10)
);
create index audit_log_overrides on public.audit_log (at desc) where override_reason is not null;

-- --- Helpers ------------------------------------------------------------------------------

/** True when the signed-in user passed MFA in this session. */
create function public.mfa_ok() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

/** True when the signed-in user (with MFA) has this role; a super admin has every role. */
create function public.has_role(r public.admin_role) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.mfa_ok() and exists (
    select 1 from public.admin_roles a
    where a.user_id = auth.uid() and (a.role = r or a.role = 'super_admin')
  )
$$;

/** True when the signed-in user (with MFA) has any back-office role. */
create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.mfa_ok() and exists (select 1 from public.admin_roles a where a.user_id = auth.uid())
$$;

create function public.write_audit(
  p_action text, p_target text, p_before jsonb, p_after jsonb, p_reason text
) returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (user_id, action, target, before, after, override_reason)
  values (auth.uid(), p_action, p_target, p_before, p_after, p_reason)
  returning id
$$;
revoke all on function public.write_audit(text, text, jsonb, jsonb, text) from public;

-- --- Roles --------------------------------------------------------------------------------

/** Give someone a role. Owners grant roles below owner; only a super admin grants owner or super admin. */
create function public.grant_role(p_user uuid, p_role public.admin_role) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_role in ('super_admin', 'owner') then
    if not public.has_role('super_admin') then
      raise exception 'only a super admin can give the % role', p_role using errcode = '42501';
    end if;
  elsif not public.has_role('owner') then
    raise exception 'only an owner or super admin can give roles' using errcode = '42501';
  end if;
  insert into public.admin_roles (user_id, role, granted_by)
  values (p_user, p_role, auth.uid())
  on conflict (user_id, role) do nothing;
  perform public.write_audit('role.grant', p_user::text, null,
    jsonb_build_object('role', p_role), null);
end
$$;

/** Take a role away. The same rules as granting; the last super admin can't be removed. */
create function public.revoke_role(p_user uuid, p_role public.admin_role) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_role in ('super_admin', 'owner') then
    if not public.has_role('super_admin') then
      raise exception 'only a super admin can take away the % role', p_role using errcode = '42501';
    end if;
  elsif not public.has_role('owner') then
    raise exception 'only an owner or super admin can take away roles' using errcode = '42501';
  end if;
  delete from public.admin_roles where user_id = p_user and role = p_role;
  perform public.write_audit('role.revoke', p_user::text,
    jsonb_build_object('role', p_role), null, null);
end
$$;

/** Keeps at least one super admin, whoever deletes the row (a person, the service role, or a
    deleted user account). */
create function public.keep_a_super_admin() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'super_admin'
     and not exists (select 1 from public.admin_roles where role = 'super_admin') then
    raise exception 'there must always be at least one super admin' using errcode = '23514';
  end if;
  return null;
end
$$;
create constraint trigger admin_roles_keep_super_admin
  after delete or update on public.admin_roles
  deferrable initially deferred
  for each row execute function public.keep_a_super_admin();

/** The very first super admin, set up once by the owner with the service key (never from a page). */
create function public.bootstrap_super_admin(p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.admin_roles where role = 'super_admin') then
    raise exception 'a super admin already exists' using errcode = '42501';
  end if;
  insert into public.admin_roles (user_id, role, granted_by) values (p_user, 'super_admin', null);
  insert into public.audit_log (user_id, action, target, after)
  values (null, 'role.bootstrap', p_user::text, jsonb_build_object('role', 'super_admin'));
end
$$;
revoke all on function public.bootstrap_super_admin(uuid) from public;
grant execute on function public.bootstrap_super_admin(uuid) to service_role;

-- --- Audit log and overrides --------------------------------------------------------------

/** Any back-office user records an action they took (the admin app calls this). */
create function public.log_action(p_action text, p_target text, p_before jsonb, p_after jsonb)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only back-office users with MFA can write to the audit log' using errcode = '42501';
  end if;
  return public.write_audit(p_action, p_target, p_before, p_after, null);
end
$$;

/** A super admin skips a normal check (e.g. approves their own work). A written reason is
    required and the entry is marked as an override for every owner to see. */
create function public.record_override(
  p_action text, p_target text, p_reason text, p_details jsonb
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.has_role('super_admin') then
    raise exception 'only a super admin can override a check' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'an override needs a reason of at least 10 characters' using errcode = '22023';
  end if;
  return public.write_audit(p_action, p_target, null, p_details, btrim(p_reason));
end
$$;

/** The audit log can never be changed or emptied, even by the table owner by mistake. */
create function public.audit_log_is_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'the audit log can''t be changed or deleted' using errcode = '42501';
end
$$;
create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_is_append_only();

-- --- Row-level security and grants ------------------------------------------------------

alter table public.admin_roles enable row level security;
alter table public.audit_log enable row level security;

-- Everyone with MFA sees their own roles; owners and super admins see everyone's.
create policy admin_roles_read on public.admin_roles for select to authenticated
  using (public.mfa_ok() and (user_id = auth.uid() or public.has_role('owner')));

-- Owners and super admins read the audit log. Nobody writes to it directly.
create policy audit_log_read on public.audit_log for select to authenticated
  using (public.has_role('owner'));

revoke all on public.admin_roles, public.audit_log from public, anon, authenticated, service_role;
grant select on public.admin_roles, public.audit_log to authenticated;
-- The service role may read (for the admin app's server routes and alerts), never change the log.
grant select on public.admin_roles, public.audit_log to service_role;

revoke all on function public.grant_role(uuid, public.admin_role),
  public.revoke_role(uuid, public.admin_role),
  public.log_action(text, text, jsonb, jsonb),
  public.record_override(text, text, text, jsonb) from public, anon;
grant execute on function public.grant_role(uuid, public.admin_role),
  public.revoke_role(uuid, public.admin_role),
  public.log_action(text, text, jsonb, jsonb),
  public.record_override(text, text, text, jsonb),
  public.has_role(public.admin_role),
  public.is_admin(),
  public.mfa_ok() to authenticated;
