-- M5 step 4e (part 1): dormant accounts are deleted only after confirmation in the back office
-- (docs/specs/M5-teach.md v0.5 §7.5, owner decisions 2026-11-25):
--   * at 12 months without signing in, an account is "due for deletion" (a daily job marks it);
--   * the data protection officer sees each due account (kind, the school, club or adult's
--     display name it is linked to, last sign-in, how many learners would go; never a child's
--     name or anyone's contact details) and confirms, or keeps one with a reason;
--   * an account not confirmed within 30 days is locked for 30 days (nobody can use it or sign
--     its learners in), then deleted;
--   * every confirmation, keep and deletion is in the audit log (counts, never names).
-- This replaces delete_dormant_accounts (0010), which deleted at 12 months without anyone
-- confirming.

alter table public.adults
  add column deletion_due_at timestamptz,
  add column locked_until timestamptz;

drop function public.delete_dormant_accounts();

/** Signing in is refused while an account is locked; every adult action checks this. */
create or replace function public.require_adult() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare v uuid := public.current_adult();
begin
  if v is null then
    raise exception 'sign in as an adult first' using errcode = '42501';
  end if;
  if exists (select 1 from public.adults where user_id = v and locked_until > now()) then
    raise exception 'this account is locked because it was not used for over a year; contact Robots For All to keep it, or it will be deleted' using errcode = '42501';
  end if;
  return v;
end
$$;

/** Signing in also takes an account off the deletion list (it is in use again). */
create or replace function public.touch_adult(p_display_name text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v uuid := public.require_adult();
begin
  insert into public.adults (user_id, display_name)
  values (v, coalesce(nullif(btrim(p_display_name), ''), 'Robots For All member'))
  on conflict (user_id) do update
    set last_seen_at = now(), dormancy_notices = 0, deletion_due_at = null,
        display_name = coalesce(nullif(btrim(p_display_name), ''), public.adults.display_name);
end
$$;

/** Learners whose every parent or guardian is locked can't sign in either. */
create or replace function public.sign_in_roster(p_class_code text)
returns table (learner_id uuid, nickname text, avatar text)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.nickname, l.avatar
    from public.classes c
    join public.class_learners cl on cl.class_id = c.id
    join public.learners l on l.id = cl.learner_id
   where c.class_code = upper(p_class_code)
     and public.has_consent(l.id, 'record') and public.has_consent(l.id, 'class', c.id)
     and exists (select 1 from public.learner_guardians g
                   left join public.adults a on a.user_id = g.user_id
                  where g.learner_id = l.id
                    and (a.locked_until is null or a.locked_until <= now()))
   order by lower(l.nickname)
$$;

/**
 * Deletes these adults' accounts: with each, every learner profile only they look after that is
 * in no class (learners still in a class stay, linked to the class only, until it ends).
 */
create function public.delete_adult_accounts(p_users uuid[]) returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_count int;
begin
  delete from public.learners l
   where exists (select 1 from public.learner_guardians g
                  where g.learner_id = l.id and g.user_id = any (p_users))
     and not exists (select 1 from public.learner_guardians g
                      where g.learner_id = l.id and g.user_id <> all (p_users))
     and not exists (select 1 from public.class_learners cl where cl.learner_id = l.id);
  delete from auth.users where id = any (p_users);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- --- The daily job (service role) ---------------------------------------------------------------

/** 12 months without signing in: due for deletion. Returns how many were added today. */
create function public.mark_due_for_deletion() returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_count int;
begin
  update public.adults set deletion_due_at = now()
   where deletion_due_at is null and locked_until is null
     and last_seen_at <= now() - interval '12 months';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

/** Due for 30 days and nobody confirmed: locked for 30 days. */
create function public.lock_unconfirmed_deletions() returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_count int;
begin
  update public.adults set locked_until = now() + interval '30 days'
   where deletion_due_at <= now() - interval '30 days' and locked_until is null;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform public.write_audit('privacy.accounts_locked', null, null,
      jsonb_build_object('count', v_count), null);
  end if;
  return v_count;
end
$$;

/** The lock has run out: deleted. */
create function public.delete_after_lock() returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_users uuid[]; v_count int;
begin
  select coalesce(array_agg(user_id), '{}') into v_users
    from public.adults where locked_until <= now();
  if cardinality(v_users) = 0 then return 0; end if;
  v_count := public.delete_adult_accounts(v_users);
  perform public.write_audit('privacy.deleted_after_lock', null, null,
    jsonb_build_object('count', v_count), null);
  return v_count;
end
$$;

/** For the weekly notice to the back office: what is waiting. */
create function public.deletion_counts()
returns table (due int, waiting_over_7_days int, locked int)
language sql stable security definer
set search_path = ''
as $$
  select count(*) filter (where deletion_due_at is not null and locked_until is null)::int,
         count(*) filter (where deletion_due_at <= now() - interval '7 days' and locked_until is null)::int,
         count(*) filter (where locked_until > now())::int
    from public.adults
$$;

-- --- The back office: the data protection officer ---------------------------------------------

/** Privacy → Due for deletion: no child's name, no contact details. */
create function public.deletion_due_list()
returns table (user_id uuid, display_name text, account_kind text, linked_to text,
  last_seen_at timestamptz, learners_to_go int, due_since timestamptz, locked_until timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.has_role('data_protection_officer') then
    raise exception 'only the data protection officer can see accounts due for deletion' using errcode = '42501';
  end if;
  return query
    select a.user_id, a.display_name,
           coalesce(
             (select string_agg(distinct s.role::text, ', ' order by s.role::text)
                from public.organisation_staff s where s.user_id = a.user_id),
             case when exists (select 1 from public.learner_guardians g where g.user_id = a.user_id)
                  then 'parent' else 'adult' end),
           coalesce(
             (select string_agg(distinct o.name, ', ' order by o.name)
                from public.organisation_staff s join public.organisations o on o.id = s.organisation_id
               where s.user_id = a.user_id),
             a.display_name),
           a.last_seen_at,
           (select count(*)::int from public.learners l
             where exists (select 1 from public.learner_guardians g
                            where g.learner_id = l.id and g.user_id = a.user_id)
               and not exists (select 1 from public.learner_guardians g
                                where g.learner_id = l.id and g.user_id <> a.user_id)
               and not exists (select 1 from public.class_learners cl where cl.learner_id = l.id)),
           a.deletion_due_at, a.locked_until
      from public.adults a
     where a.deletion_due_at is not null
     order by a.deletion_due_at, a.display_name;
end
$$;

/** Confirms deletion of these due accounts. Returns how many were deleted. */
create function public.confirm_deletions(p_users uuid[]) returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_users uuid[]; v_count int;
begin
  if not public.has_role('data_protection_officer') then
    raise exception 'only the data protection officer can confirm deletions' using errcode = '42501';
  end if;
  select coalesce(array_agg(user_id), '{}') into v_users
    from public.adults where user_id = any (p_users) and deletion_due_at is not null;
  if cardinality(v_users) = 0 then return 0; end if;
  v_count := public.delete_adult_accounts(v_users);
  perform public.write_audit('privacy.deletion_confirmed', null, null,
    jsonb_build_object('count', v_count), null);
  return v_count;
end
$$;

/** Keeps a due or locked account, with a reason (e.g. a complaint under way); it starts again. */
create function public.keep_account(p_user uuid, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.has_role('data_protection_officer') then
    raise exception 'only the data protection officer can keep an account' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'say why this account is kept' using errcode = '22023';
  end if;
  update public.adults
     set deletion_due_at = null, locked_until = null, last_seen_at = now(), dormancy_notices = 0
   where user_id = p_user and deletion_due_at is not null;
  if not found then
    raise exception 'that account is not due for deletion' using errcode = 'P0002';
  end if;
  perform public.write_audit('privacy.account_kept', 'adult:' || p_user, null,
    jsonb_build_object('reason', btrim(p_reason)), null);
end
$$;

revoke all on function public.delete_adult_accounts(uuid[]), public.mark_due_for_deletion(),
  public.lock_unconfirmed_deletions(), public.delete_after_lock(), public.deletion_counts()
  from public, anon, authenticated;
grant execute on function public.mark_due_for_deletion(), public.lock_unconfirmed_deletions(),
  public.delete_after_lock(), public.deletion_counts() to service_role;
revoke all on function public.deletion_due_list(), public.confirm_deletions(uuid[]),
  public.keep_account(uuid, text) from public, anon;
grant execute on function public.deletion_due_list(), public.confirm_deletions(uuid[]),
  public.keep_account(uuid, text) to authenticated;
