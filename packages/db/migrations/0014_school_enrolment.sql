-- M5 step 4b: a school or club enrols learners for their parents to confirm (spec FR-5a,
-- v0.5 §6.2: by email for now). The certificate service (service role) locks the child's name
-- and the parent's email before calling create_pending_enrolment (0010), sends the email, and
-- handles the parent's confirmation. These helpers let it do that without reading any table
-- directly; staff can withdraw a request they made by mistake.

/** The class's and organisation's names, for the email to the parent (no learner data). */
create function public.class_label(p_class uuid)
returns table (class_name text, organisation_name text, language text)
language sql stable security definer
set search_path = ''
as $$
  select c.name, o.name, c.language
    from public.classes c join public.organisations o on o.id = c.organisation_id
   where c.id = p_class
$$;

/** A waiting enrolment by the hash of its link's secret, while it is still valid. */
create function public.pending_for_token(p_hash text)
returns table (id uuid, class_id uuid, class_name text, organisation_name text, grade int,
  certificate_name bytea, certificate_name_key_version int,
  parent_contact bytea, parent_contact_key_version int)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.class_id, c.name, o.name, p.grade, p.certificate_name,
         p.certificate_name_key_version, p.parent_contact, p.parent_contact_key_version
    from public.pending_enrolments p
    join public.classes c on c.id = p.class_id
    join public.organisations o on o.id = c.organisation_id
   where p.confirm_token_hash = p_hash and p.expires_at > now()
$$;

/** Removes a waiting enrolment whose email could not be sent (service only). */
create function public.drop_pending_enrolment(p_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  delete from public.pending_enrolments where id = p_id
$$;

revoke all on function public.class_label(uuid), public.pending_for_token(text),
  public.drop_pending_enrolment(uuid) from public, anon, authenticated;
grant execute on function public.class_label(uuid), public.pending_for_token(text),
  public.drop_pending_enrolment(uuid) to service_role;

/** A class's teacher or coach withdraws a waiting enrolment (sent to the wrong parent, say). */
create function public.cancel_pending_enrolment(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_class uuid;
begin
  perform public.require_adult();
  select class_id into v_class from public.pending_enrolments where id = p_id;
  if v_class is null or not public.is_class_staff(v_class) then
    raise exception 'only the class''s teachers and coaches can withdraw that' using errcode = '42501';
  end if;
  delete from public.pending_enrolments where id = p_id;
end
$$;

revoke all on function public.cancel_pending_enrolment(uuid) from public, anon;
grant execute on function public.cancel_pending_enrolment(uuid) to authenticated;
