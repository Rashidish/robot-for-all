-- M5 step 7b: awarding badges automatically (FR-19a). The certificate service (service role)
-- reads a learner's records, applies the rules in packages/badges and calls award_badge (0010).
--   * whoami_learner: a learner session asks to be checked; the service learns who it is from
--     the database itself, never from what the browser says;
--   * badge_records: the records that count for badges (not revoked; checked ones only where any
--     of the learner's classes has "badges need a check", FR-15);
--   * learners_with_new_records: who the nightly sweep looks at;
--   * learner_guardian_emails: where the "your child earned a badge" email goes. It names the
--     nickname and the badge, never the certificate name (FR-19a).

create function public.whoami_learner() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select public.current_learner()
$$;

create function public.badge_records(p_learner uuid)
returns table (lesson_id text, sheet_code text, steps_done int, i_can boolean[],
  built_working boolean, recorded_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select r.lesson_id, r.sheet_code, r.steps_done, r.i_can, r.built_working, r.recorded_at
    from public.sheet_records r
   where r.learner_id = p_learner and r.revoked_at is null
     and public.has_consent(p_learner, 'record')
     and (r.checked_at is not null or not exists (
           select 1 from public.class_learners cl join public.classes c on c.id = cl.class_id
            where cl.learner_id = p_learner and c.badges_need_check))
$$;

create function public.learners_with_new_records(p_since interval)
returns table (learner_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select distinct r.learner_id from public.sheet_records r
   where r.received_at > now() - p_since or r.checked_at > now() - p_since
$$;

create function public.learner_guardian_emails(p_learner uuid)
returns table (email text, nickname text, language text)
language sql stable security definer
set search_path = ''
as $$
  select u.email::text, l.nickname, l.language
    from public.learner_guardians g
    join auth.users u on u.id = g.user_id
    join public.learners l on l.id = g.learner_id
    left join public.adults a on a.user_id = g.user_id
   where g.learner_id = p_learner and u.email is not null
     and (a.locked_until is null or a.locked_until <= now())
$$;

revoke all on function public.whoami_learner() from public, anon;
grant execute on function public.whoami_learner() to authenticated;
revoke all on function public.badge_records(uuid), public.learners_with_new_records(interval),
  public.learner_guardian_emails(uuid) from public, anon, authenticated;
grant execute on function public.badge_records(uuid), public.learners_with_new_records(interval),
  public.learner_guardian_emails(uuid) to service_role;
