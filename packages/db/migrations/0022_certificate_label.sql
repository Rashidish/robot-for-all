-- M5 step 8a: which school or club a learner's certificate names (FR-28, FR-29; family and
-- personal spec FC-1, FC-2). Every awarded badge gets a verification code (issue_certificate_code,
-- 0010) with this label; /verify/ shows it, never a name or nickname.
--   * a teacher or coach of a school or club checked one of the learner's counting records: that
--     school or club (the most recent check);
--   * otherwise the school or club of the learner's most recent class;
--   * an organisation not yet verified carries " (not yet verified)";
--   * no school or club (family groups and personal learners, later): 'Robots For All', which
--     /verify/ shows as "Awarded by Robots For All" (owner decision 2026-11-25).

create function public.certificate_label(p_learner uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  with checked as (
    select o.name, o.verified_at, r.checked_at as at
      from public.sheet_records r
      join public.class_staff s on s.user_id = r.checked_by
      join public.class_learners cl on cl.class_id = s.class_id and cl.learner_id = r.learner_id
      join public.classes c on c.id = s.class_id
      join public.organisations o on o.id = c.organisation_id
     where r.learner_id = p_learner and r.checked_at is not null and r.revoked_at is null
     order by r.checked_at desc limit 1
  ), latest as (
    select o.name, o.verified_at, cl.joined_at as at
      from public.class_learners cl
      join public.classes c on c.id = cl.class_id
      join public.organisations o on o.id = c.organisation_id
     where cl.learner_id = p_learner
     order by cl.joined_at desc limit 1
  )
  select coalesce(
    (select name || case when verified_at is null then ' (not yet verified)' else '' end
       from (select * from checked union all select * from latest) x limit 1),
    'Robots For All')
$$;

revoke all on function public.certificate_label(uuid) from public, anon, authenticated;
grant execute on function public.certificate_label(uuid) to service_role;
