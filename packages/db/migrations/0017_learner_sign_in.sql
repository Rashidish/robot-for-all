-- M5 step 5a: learner sign-in (ADR-0013 and its amendment, owner decision 2026-11-25: learner
-- sessions are signed with Supabase's own JWT secret by a separate sign-in service, so this
-- database's rules keep each learner to their own rows).
--   * A learner session is a token with role "authenticated", kind "learner", learner_id and
--     sv (session version). Bumping a learner's session_version signs them out everywhere.
--   * The sign-in service (service role) reads only what it needs for one learner in one class,
--     and a first PIN can be chosen only while none is set.

alter table public.learners add column session_version int not null default 1;

/** The learner of this session, or null; a token from before a "sign out everywhere" is refused. */
create or replace function public.current_learner() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select l.id from public.learners l
   where auth.jwt() ->> 'kind' = 'learner'
     and l.id = nullif(auth.jwt() ->> 'learner_id', '')::uuid
     and l.session_version = coalesce(nullif(auth.jwt() ->> 'sv', '')::int, 0)
$$;

/**
 * For the sign-in service: one learner who may sign in to this class now (on its roster: both
 * consents, a parent not locked), with what is needed to check the PIN. Nothing else.
 */
create function public.learner_for_sign_in(p_class_code text, p_learner uuid)
returns table (learner_id uuid, nickname text, avatar text, pin_hash text,
  locked_until timestamptz, session_version int)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.nickname, l.avatar, l.pin_hash, l.locked_until, l.session_version
    from public.sign_in_roster(p_class_code) r
    join public.learners l on l.id = r.learner_id
   where l.id = p_learner
$$;

/** A learner's first PIN (or a new one after a reset): only while none is set. */
create function public.choose_learner_pin(p_learner uuid, p_hash text) returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.learners set pin_hash = p_hash, pin_failures = 0, locked_until = null
   where id = p_learner and pin_hash is null;
  return found;
end
$$;

/** "Sign out everywhere": a teacher, coach or parent ends every session of this learner. */
create function public.revoke_learner_sessions(p_learner uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not (public.is_guardian(p_learner) or public.staff_sees_learner(p_learner)) then
    raise exception 'only the learner''s teacher, coach or parent can do that' using errcode = '42501';
  end if;
  update public.learners set session_version = session_version + 1 where id = p_learner;
end
$$;

revoke all on function public.learner_for_sign_in(text, uuid), public.choose_learner_pin(uuid, text)
  from public, anon, authenticated;
grant execute on function public.learner_for_sign_in(text, uuid), public.choose_learner_pin(uuid, text)
  to service_role;
revoke all on function public.revoke_learner_sessions(uuid) from public, anon;
grant execute on function public.revoke_learner_sessions(uuid) to authenticated;
