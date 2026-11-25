-- M5 step 3d: inviting staff to a school or club (docs/specs/M5-teach.md §3, FR-2).
-- The admin makes a one-time invitation link and shares it themselves (WhatsApp, email): we
-- store no invitee email or phone and send nothing. Only the SHA-256 of the link's secret is
-- kept; it expires after 7 days and works once.

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  role public.staff_role not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

alter table public.staff_invitations enable row level security;
revoke all on public.staff_invitations from anon, authenticated;
create policy admin on public.staff_invitations for select to authenticated
  using (public.is_org_staff(organisation_id, true));
grant select (id, organisation_id, role, created_at, expires_at, used_at)
  on public.staff_invitations to authenticated;

/** The admin makes an invitation; returns the secret for the link, once (never stored). */
create function public.create_staff_invitation(p_org uuid, p_role public.staff_role) returns text
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_token text := public.random_token() || public.random_token();
begin
  if not public.is_org_staff(p_org, true) then
    raise exception 'only the organisation''s admin can invite staff' using errcode = '42501';
  end if;
  insert into public.staff_invitations (organisation_id, role, token_hash, created_by)
  values (p_org, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_user);
  return v_token;
end
$$;

/** A signed-in colleague opens the link: they join with the invited role. Returns the organisation. */
create function public.accept_staff_invitation(p_token text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_inv public.staff_invitations;
begin
  select * into v_inv from public.staff_invitations
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'this invitation has expired, was used already or is wrong; ask for a new one' using errcode = 'P0002';
  end if;
  insert into public.organisation_staff (organisation_id, user_id, role)
  values (v_inv.organisation_id, v_user, v_inv.role)
  on conflict (organisation_id, user_id) do nothing;
  update public.staff_invitations set used_at = now(), used_by = v_user where id = v_inv.id;
  return v_inv.organisation_id;
end
$$;

create function public.revoke_staff_invitation(p_invitation uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  perform public.require_adult();
  select organisation_id into v_org from public.staff_invitations where id = p_invitation;
  if v_org is null or not public.is_org_staff(v_org, true) then
    raise exception 'only the organisation''s admin can do that' using errcode = '42501';
  end if;
  delete from public.staff_invitations where id = p_invitation;
end
$$;

/** The organisation's staff, by the name each chose to show (staff of the same organisation only). */
create function public.organisation_staff_list(p_org uuid)
returns table (user_id uuid, display_name text, role public.staff_role)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_org_staff(p_org) then
    raise exception 'only staff of this organisation can see its staff' using errcode = '42501';
  end if;
  return query
    select s.user_id, coalesce(a.display_name, '—'), s.role
      from public.organisation_staff s
      left join public.adults a on a.user_id = s.user_id
     where s.organisation_id = p_org
     order by s.role, a.display_name;
end
$$;

/** The admin removes a colleague; the last admin can't be removed. Their class links go too. */
create function public.remove_staff(p_org uuid, p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_org_staff(p_org, true) then
    raise exception 'only the organisation''s admin can remove staff' using errcode = '42501';
  end if;
  if (select role from public.organisation_staff where organisation_id = p_org and user_id = p_user) = 'admin'
     and (select count(*) from public.organisation_staff where organisation_id = p_org and role = 'admin') = 1 then
    raise exception 'a school or club needs at least one admin; make someone else admin first' using errcode = '23514';
  end if;
  delete from public.class_staff cs using public.classes c
   where cs.class_id = c.id and c.organisation_id = p_org and cs.user_id = p_user;
  delete from public.organisation_staff where organisation_id = p_org and user_id = p_user;
end
$$;
