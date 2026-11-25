-- M5 step 4d: "Show names" on the teacher's console (docs/specs/M5-teach.md FR-22a, ADR-0015
-- amendment 1). Only the certificate service (service role) calls it: it checks the caller is
-- one of the class's teachers or coaches at a verified school or club, returns that class's
-- encrypted names (only for learners whose parent gave consents a, b and c), and logs the
-- reveal: who, which class, when and how many names, never the names.

create table public.name_reveals (
  id bigint generated always as identity primary key,
  class_id uuid references public.classes (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  names_shown int not null check (names_shown >= 0),
  revealed_at timestamptz not null default now()
);

alter table public.name_reveals enable row level security;
revoke all on public.name_reveals from anon, authenticated;
create policy support on public.name_reveals for select to authenticated
  using (public.has_role('support'));
grant select on public.name_reveals to authenticated;
grant select on public.name_reveals to service_role;

create function public.reveal_class_names(p_class uuid, p_by uuid)
returns table (learner_id uuid, certificate_name bytea, key_version int)
language plpgsql security definer
set search_path = ''
as $$
declare v_count int;
begin
  if not exists (select 1 from public.class_staff where class_id = p_class and user_id = p_by) then
    raise exception 'only the class''s teachers and coaches can see its names' using errcode = '42501';
  end if;
  if not exists (select 1 from public.classes c join public.organisations o on o.id = c.organisation_id
                  where c.id = p_class and o.verified_at is not null) then
    raise exception 'names can be shown once the school or club is verified' using errcode = '42501';
  end if;
  return query
    select l.id, l.certificate_name, l.certificate_name_key_version
      from public.class_learners cl
      join public.learners l on l.id = cl.learner_id
     where cl.class_id = p_class
       and l.certificate_name is not null
       and public.has_consent(l.id, 'record')
       and public.has_consent(l.id, 'name')
       and public.has_consent(l.id, 'class', p_class);
  get diagnostics v_count = row_count;
  insert into public.name_reveals (class_id, user_id, names_shown) values (p_class, p_by, v_count);
end
$$;

revoke all on function public.reveal_class_names(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reveal_class_names(uuid, uuid) to service_role;
