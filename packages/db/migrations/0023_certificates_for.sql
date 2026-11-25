-- M5 step 8b: what the certificate service may draw, for whom (FR-26 to FR-28, ADR-0015).
--   * one award: the learner's parent or guardian, or a teacher or coach of one of the learner's
--     classes (with consents a and c);
--   * a class: its teachers and coaches, for every consented learner's awards (optionally one
--     badge).
-- The encrypted certificate name comes back only with consent b, and only to the certificate
-- service (service role), which decrypts it in memory to draw the PDF. Revoked badges never.

create function public.certificates_for(p_by uuid, p_award uuid default null,
  p_class uuid default null, p_badge text default null)
returns table (award_id uuid, learner_id uuid, badge_id text, awarded_at timestamptz,
  code text, certificate_name bytea, key_version int, language text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (p_award is null) = (p_class is null) then
    raise exception 'ask for one award or one class' using errcode = '22023';
  end if;
  if p_class is not null and not exists (
       select 1 from public.class_staff where class_id = p_class and user_id = p_by) then
    raise exception 'only the class''s teachers and coaches can print its certificates' using errcode = '42501';
  end if;
  return query
    select a.id, l.id, a.badge_id, a.awarded_at,
           (select c.code from public.certificate_codes c
             where c.badge_award_id = a.id and c.revoked_at is null
             order by c.issued_on desc limit 1),
           case when public.has_consent(l.id, 'name') then l.certificate_name end,
           case when public.has_consent(l.id, 'name') then l.certificate_name_key_version end,
           l.language
      from public.badge_awards a
      join public.learners l on l.id = a.learner_id
     where a.revoked_at is null
       and public.has_consent(l.id, 'record')
       and (
         (p_award is not null and a.id = p_award and (
            exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = p_by)
            or exists (select 1 from public.class_learners cl
                         join public.class_staff s on s.class_id = cl.class_id
                        where cl.learner_id = l.id and s.user_id = p_by
                          and public.has_consent(l.id, 'class', cl.class_id))))
         or (p_class is not null
             and exists (select 1 from public.class_learners cl
                          where cl.class_id = p_class and cl.learner_id = l.id)
             and public.has_consent(l.id, 'class', p_class)
             and (p_badge is null or a.badge_id = p_badge))
       )
     order by lower(l.nickname), a.awarded_at;
end
$$;

revoke all on function public.certificates_for(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.certificates_for(uuid, uuid, uuid, text) to service_role;
