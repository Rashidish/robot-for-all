-- M5 Teach (docs/specs/M5-teach.md §6.1; ADR-0013, ADR-0014, ADR-0015).
-- Organisations, classes, learners, consent, answer-sheet records, badges and certificate codes.
--
-- Rules kept here, in the database:
--   * learners are not Supabase users: a learner's session token carries kind = "learner" and
--     learner_id, and gives access to that learner's own rows only (ADR-0013);
--   * no column holds a readable real name: the certificate name and a pending parent contact
--     arrive already encrypted by the certificate service (ADR-0015), and no app role may read
--     them; only the service role (the Workers) can;
--   * nothing is recorded for a child before a parent's consent, and withdrawing consent deletes;
--   * every write that needs a rule goes through a function; tables give app roles only the
--     reads (and the learner's own sheet records) that their row-level policies allow.

-- --- Who is calling ------------------------------------------------------------------------

/** The learner of a learner session (ADR-0013), or null. */
create function public.current_learner() returns uuid
language sql stable
set search_path = ''
as $$
  select case when auth.jwt() ->> 'kind' = 'learner'
    then nullif(auth.jwt() ->> 'learner_id', '')::uuid end
$$;

/** The signed-in adult (parent, teacher, coach, organisation admin), or null for a learner. */
create function public.current_adult() returns uuid
language sql stable
set search_path = ''
as $$
  select case when coalesce(auth.jwt() ->> 'kind', '') <> 'learner' then auth.uid() end
$$;

-- --- Tables --------------------------------------------------------------------------------

create table public.adults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 2 and 60),
  last_seen_at timestamptz not null default now(),
  -- Dormancy messages sent since the last sign-in (spec §7.5: at 10 and 11 months).
  dormancy_notices int not null default 0
);

create type public.organisation_kind as enum ('school', 'club');
create type public.verification_route as enum (
  'official_email', 'official_phone', 'principal_letter', 'register',
  'vouched', 'references', 'call_and_reference'
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  kind public.organisation_kind not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  province text check (province is null or length(province) <= 40),
  -- Schools: the DBE EMIS number. Registered clubs: an NPO, CIPC or municipal number.
  emis text unique check (emis is null or emis ~ '^[0-9]{6,12}$'),
  register_no text check (register_no is null or length(register_no) <= 40),
  registered boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  verified_route public.verification_route,
  reverify_by date,
  created_at timestamptz not null default now(),
  check (kind = 'club' or emis is not null),
  check ((verified_at is null) = (verified_route is null))
);

create type public.staff_role as enum ('admin', 'teacher', 'coach');

create table public.organisation_staff (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.staff_role not null,
  primary key (organisation_id, user_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 60),
  grade_band text not null check (grade_band in ('3-4', '5-6', '7-9', '10-12', 'mixed')),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  -- Learner sign-in (ADR-0013): six consonants, so it never spells a word.
  class_code text not null unique check (class_code ~ '^[BCDFGHJKLMNPQRSTVWXZ]{6}$'),
  -- Parents' enrolment link (spec FR-3); renewable.
  enrol_token text not null unique check (enrol_token ~ '^[0-9a-f]{32}$'),
  enrol_open boolean not null default true,
  badges_need_check boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.class_staff (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (class_id, user_id)
);

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (length(btrim(nickname)) between 2 and 20),
  grade int not null check (grade between 1 and 12),
  avatar text not null default 'robot' check (avatar ~ '^[a-z0-9-]{1,30}$'),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  -- Hashed by the sign-in Worker (ADR-0013); never readable by app roles.
  pin_hash text,
  pin_failures int not null default 0,
  locked_until timestamptz,
  -- AES-256-GCM ciphertext from the certificate service (ADR-0015); never readable by app roles.
  certificate_name bytea,
  certificate_name_key_version int,
  created_at timestamptz not null default now(),
  check ((certificate_name is null) = (certificate_name_key_version is null))
);

create table public.learner_guardians (
  learner_id uuid not null references public.learners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (learner_id, user_id)
);

create table public.class_learners (
  class_id uuid not null references public.classes (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, learner_id)
);

create type public.consent_control as enum ('record', 'name', 'class', 'event_results');

create table public.consents (
  id bigint generated always as identity primary key,
  learner_id uuid not null references public.learners (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  control public.consent_control not null,
  class_id uuid references public.classes (id) on delete cascade,
  notice_version text not null check (notice_version ~ '^[0-9]+(\.[0-9]+)*$'),
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check ((control = 'class') = (class_id is not null))
);

-- A school's or club's enrolment, waiting for a parent to confirm (spec FR-5a); 14 days at most.
create table public.pending_enrolments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  grade int not null check (grade between 1 and 12),
  certificate_name bytea not null,
  certificate_name_key_version int not null,
  parent_contact bytea not null,
  parent_contact_key_version int not null,
  -- SHA-256 of the secret in the parent's confirmation link (the secret itself is never stored).
  confirm_token_hash text not null unique check (confirm_token_hash ~ '^[0-9a-f]{64}$'),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  reminders_sent int not null default 0,
  expires_at timestamptz not null default now() + interval '14 days'
);

-- Answer-sheet records (answer-sheets Part B; ADR-0014: the id is made on the phone).
create table public.sheet_records (
  id text primary key check (id ~ '^[0-9a-f]{32,64}$'),
  learner_id uuid not null references public.learners (id) on delete cascade,
  lesson_id text not null check (lesson_id ~ '^p[1-3]-[a-z]+-[0-9]{2}$'),
  sheet_code text not null check (sheet_code ~ '^p[1-3]-[a-z]+-[0-9]{2}-([a-z]{2,3}-)?[0-9a-f]{6}$'),
  steps_done int not null check (steps_done between 0 and 100),
  i_can boolean[] not null check (cardinality(i_can) between 1 and 10),
  built_working boolean not null,
  team_sheet boolean not null default false,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index sheet_records_learner on public.sheet_records (learner_id, lesson_id);

create table public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  badge_id text not null check (badge_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  rule_version text not null,
  awarded_at timestamptz not null default now(),
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  unique (learner_id, badge_id)
);

-- Verification codes outlive the learner (spec FR-35): no link to a child once deleted.
create table public.certificate_codes (
  code text primary key check (code ~ '^RFA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$'),
  badge_award_id uuid references public.badge_awards (id) on delete set null,
  badge_id text not null,
  issued_on date not null default current_date,
  issued_by_label text not null check (length(issued_by_label) between 2 and 160),
  revoked_at timestamptz
);

-- --- Predicates (security definer, so policies don't recurse) -----------------------------

create function public.is_guardian(p_learner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.learner_guardians g
    where g.learner_id = p_learner and g.user_id = public.current_adult())
$$;

create function public.is_org_staff(p_org uuid, p_admin_only boolean default false) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.organisation_staff s
    where s.organisation_id = p_org and s.user_id = public.current_adult()
      and (not p_admin_only or s.role = 'admin'))
$$;

create function public.is_class_staff(p_class uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.class_staff s
    where s.class_id = p_class and s.user_id = public.current_adult())
$$;

create function public.has_consent(p_learner uuid, p_control public.consent_control,
  p_class uuid default null) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.consents c
    where c.learner_id = p_learner and c.control = p_control and c.withdrawn_at is null
      and (p_class is null or c.class_id = p_class))
$$;

/** A teacher or coach sees a learner only in their own class, with both consents (spec FR-10). */
create function public.staff_sees_learner(p_learner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_consent(p_learner, 'record') and exists (
    select 1 from public.class_learners cl
    join public.class_staff s on s.class_id = cl.class_id
    where cl.learner_id = p_learner and s.user_id = public.current_adult()
      and public.has_consent(p_learner, 'class', cl.class_id))
$$;

-- --- Row-level security: reads -------------------------------------------------------------

alter table public.adults enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_staff enable row level security;
alter table public.classes enable row level security;
alter table public.class_staff enable row level security;
alter table public.learners enable row level security;
alter table public.learner_guardians enable row level security;
alter table public.class_learners enable row level security;
alter table public.consents enable row level security;
alter table public.pending_enrolments enable row level security;
alter table public.sheet_records enable row level security;
alter table public.badge_awards enable row level security;
alter table public.certificate_codes enable row level security;

revoke all on public.adults, public.organisations, public.organisation_staff, public.classes,
  public.class_staff, public.learners, public.learner_guardians, public.class_learners,
  public.consents, public.pending_enrolments, public.sheet_records, public.badge_awards,
  public.certificate_codes from anon, authenticated;

create policy own on public.adults for select to authenticated
  using (user_id = public.current_adult());
grant select on public.adults to authenticated;

create policy staff_or_support on public.organisations for select to authenticated
  using (public.is_org_staff(id) or public.has_role('support') or public.has_role('coach_verifier'));
grant select on public.organisations to authenticated;

create policy staff_or_support on public.organisation_staff for select to authenticated
  using (public.is_org_staff(organisation_id) or public.has_role('support'));
grant select on public.organisation_staff to authenticated;

create policy staff on public.classes for select to authenticated
  using (public.is_class_staff(id) or public.is_org_staff(organisation_id, true));
grant select on public.classes to authenticated;

create policy staff on public.class_staff for select to authenticated
  using (public.is_class_staff(class_id));
grant select on public.class_staff to authenticated;

create policy who_may on public.learners for select to authenticated
  using (id = public.current_learner() or public.is_guardian(id) or public.staff_sees_learner(id));
-- Never the PIN hash or the certificate name.
grant select (id, nickname, grade, avatar, language, created_at) on public.learners to authenticated;

create policy guardian on public.learner_guardians for select to authenticated
  using (public.is_guardian(learner_id));
grant select on public.learner_guardians to authenticated;

create policy staff_or_guardian on public.class_learners for select to authenticated
  using (public.is_class_staff(class_id) or public.is_guardian(learner_id));
grant select on public.class_learners to authenticated;

create policy guardian on public.consents for select to authenticated
  using (public.is_guardian(learner_id));
grant select on public.consents to authenticated;

-- Staff see that enrolments are waiting, never the encrypted name or contact.
create policy staff on public.pending_enrolments for select to authenticated
  using (public.is_class_staff(class_id));
grant select (id, class_id, grade, requested_at, reminders_sent, expires_at)
  on public.pending_enrolments to authenticated;

create policy who_may on public.sheet_records for select to authenticated
  using (learner_id = public.current_learner() or public.is_guardian(learner_id)
    or public.staff_sees_learner(learner_id));
grant select on public.sheet_records to authenticated;

-- A learner records their own sheets, offline-safe (ADR-0014): insert, and correct their own.
create policy learner_records on public.sheet_records for insert to authenticated
  with check (learner_id = public.current_learner() and public.has_consent(learner_id, 'record')
    and checked_by is null and checked_at is null and revoked_by is null and revoked_at is null);
grant insert (id, learner_id, lesson_id, sheet_code, steps_done, i_can, built_working,
  team_sheet, recorded_at) on public.sheet_records to authenticated;
create policy learner_corrects on public.sheet_records for update to authenticated
  using (learner_id = public.current_learner() and revoked_at is null)
  with check (learner_id = public.current_learner());
grant update (steps_done, i_can, built_working, team_sheet) on public.sheet_records to authenticated;

create policy who_may on public.badge_awards for select to authenticated
  using (learner_id = public.current_learner() or public.is_guardian(learner_id)
    or public.staff_sees_learner(learner_id));
grant select on public.badge_awards to authenticated;
-- certificate_codes: no direct reads; verify_certificate() below.

-- --- Helpers for writes ----------------------------------------------------------------------

create function public.require_adult() returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := public.current_adult();
begin
  if v is null then
    raise exception 'sign in as an adult first' using errcode = '42501';
  end if;
  return v;
end
$$;

create function public.random_class_code() returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  letters constant text := 'BCDFGHJKLMNPQRSTVWXZ';
  v text;
begin
  loop
    v := '';
    for i in 1..6 loop
      v := v || substr(letters, 1 + floor(random() * length(letters))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where class_code = v);
  end loop;
  return v;
end
$$;

create function public.random_token() returns text
language sql volatile
set search_path = ''
as $$ select replace(gen_random_uuid()::text, '-', '') $$;

/** Unverified organisations: one class, 40 learners (spec §7.4). */
create function public.check_trial_limits(p_class uuid) returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare v_org uuid; v_verified boolean; v_count int;
begin
  select o.id, o.verified_at is not null into v_org, v_verified
    from public.classes c join public.organisations o on o.id = c.organisation_id
    where c.id = p_class;
  if v_verified then return; end if;
  select (select count(*) from public.class_learners cl join public.classes c on c.id = cl.class_id
            where c.organisation_id = v_org)
       + (select count(*) from public.pending_enrolments p join public.classes c on c.id = p.class_id
            where c.organisation_id = v_org)
    into v_count;
  if v_count >= 40 then
    raise exception 'an organisation that is not verified yet can enrol up to 40 learners' using errcode = '54000';
  end if;
end
$$;

/** Nicknames are unique in a class (spec FR-4). */
create function public.check_nickname(p_class uuid, p_nickname text, p_except uuid default null)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.class_learners cl join public.learners l on l.id = cl.learner_id
             where cl.class_id = p_class and lower(btrim(l.nickname)) = lower(btrim(p_nickname))
               and (p_except is null or l.id <> p_except)) then
    raise exception 'that nickname is already used in this class; choose another' using errcode = '23505';
  end if;
end
$$;

create function public.give_consents(p_learner uuid, p_user uuid, p_class uuid,
  p_notice text, p_name boolean) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.consents (learner_id, user_id, control, class_id, notice_version)
  select p_learner, p_user, 'record', null, p_notice
    where not public.has_consent(p_learner, 'record');
  insert into public.consents (learner_id, user_id, control, class_id, notice_version)
  values (p_learner, p_user, 'class', p_class, p_notice);
  insert into public.consents (learner_id, user_id, control, class_id, notice_version)
  select p_learner, p_user, 'name', null, p_notice
    where p_name and not public.has_consent(p_learner, 'name');
$$;

-- --- Adults and organisations ----------------------------------------------------------------

/** Called on every adult sign-in: creates the adult row and stops any dormancy countdown. */
create function public.touch_adult(p_display_name text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v uuid := public.require_adult();
begin
  insert into public.adults (user_id, display_name)
  values (v, coalesce(nullif(btrim(p_display_name), ''), 'Robots For All member'))
  on conflict (user_id) do update
    set last_seen_at = now(), dormancy_notices = 0,
        display_name = coalesce(nullif(btrim(p_display_name), ''), public.adults.display_name);
end
$$;

create function public.register_organisation(p_kind public.organisation_kind, p_name text,
  p_province text, p_emis text, p_register_no text, p_registered boolean default true) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_id uuid;
begin
  insert into public.organisations (kind, name, province, emis, register_no, registered)
  values (p_kind, btrim(p_name), p_province, nullif(btrim(coalesce(p_emis, '')), ''),
          nullif(btrim(coalesce(p_register_no, '')), ''), coalesce(p_registered, true))
  returning id into v_id;
  insert into public.organisation_staff (organisation_id, user_id, role) values (v_id, v_user, 'admin');
  return v_id;
end
$$;

/** Back office (spec §7.4): verify once; re-check yearly for unregistered clubs, else every 2 years. */
create function public.verify_organisation(p_org uuid, p_route public.verification_route) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_org public.organisations;
begin
  if not (public.has_role('coach_verifier') or public.has_role('support')) then
    raise exception 'only a coach verifier or support can verify an organisation' using errcode = '42501';
  end if;
  select * into v_org from public.organisations where id = p_org for update;
  if not found then raise exception 'no such organisation' using errcode = 'P0002'; end if;
  if v_org.kind = 'school' and p_route not in ('official_email', 'official_phone', 'principal_letter') then
    raise exception 'schools are verified by official email, official phone or the principal''s letter' using errcode = '22023';
  end if;
  if v_org.kind = 'club' and v_org.registered and p_route not in ('register', 'official_email', 'official_phone', 'vouched') then
    raise exception 'registered clubs are verified against their register' using errcode = '22023';
  end if;
  update public.organisations
     set verified_at = now(), verified_by = auth.uid(), verified_route = p_route,
         reverify_by = current_date + case when kind = 'club' and not registered
                                           then interval '1 year' else interval '2 years' end
   where id = p_org;
  perform public.write_audit('organisation.verified', 'organisation:' || p_org, null,
    jsonb_build_object('route', p_route), null);
end
$$;

create function public.add_staff(p_org uuid, p_user uuid, p_role public.staff_role) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_org_staff(p_org, true) then
    raise exception 'only the organisation''s admin can add staff' using errcode = '42501';
  end if;
  insert into public.organisation_staff (organisation_id, user_id, role) values (p_org, p_user, p_role)
  on conflict (organisation_id, user_id) do update set role = excluded.role;
end
$$;

-- --- Classes -----------------------------------------------------------------------------------

create function public.create_class(p_org uuid, p_name text, p_grade_band text, p_language text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_id uuid;
begin
  if not public.is_org_staff(p_org) then
    raise exception 'only staff of this school or club can make a class' using errcode = '42501';
  end if;
  if (select verified_at is null from public.organisations where id = p_org)
     and exists (select 1 from public.classes where organisation_id = p_org) then
    raise exception 'an organisation that is not verified yet can have one trial class' using errcode = '54000';
  end if;
  insert into public.classes (organisation_id, name, grade_band, language, class_code, enrol_token, created_by)
  values (p_org, btrim(p_name), p_grade_band, p_language, public.random_class_code(),
          public.random_token(), v_user)
  returning id into v_id;
  insert into public.class_staff (class_id, user_id) values (v_id, v_user);
  return v_id;
end
$$;

/** Ending a class deletes it and its links (spec §7.5); learner-owned records stay with learners. */
create function public.end_class(p_class uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teacher or coach can end it' using errcode = '42501';
  end if;
  delete from public.classes where id = p_class;
end
$$;

create function public.rename_learner(p_class uuid, p_learner uuid, p_nickname text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not (public.is_class_staff(p_class) and exists (
      select 1 from public.class_learners where class_id = p_class and learner_id = p_learner)) then
    raise exception 'only the learner''s teacher or coach can rename them' using errcode = '42501';
  end if;
  perform public.check_nickname(p_class, p_nickname, p_learner);
  update public.learners set nickname = btrim(p_nickname) where id = p_learner;
end
$$;

create function public.remove_from_class(p_class uuid, p_learner uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not (public.is_class_staff(p_class) or public.is_guardian(p_learner)) then
    raise exception 'only the class''s staff or the learner''s parent can do that' using errcode = '42501';
  end if;
  delete from public.class_learners where class_id = p_class and learner_id = p_learner;
  update public.consents set withdrawn_at = now()
   where learner_id = p_learner and control = 'class' and class_id = p_class and withdrawn_at is null;
end
$$;

-- --- Enrolment by a parent (spec FR-5, FR-6) ----------------------------------------------------

create function public.enrol_child(p_enrol_token text, p_nickname text, p_grade int,
  p_avatar text, p_language text, p_notice text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_class uuid; v_id uuid;
begin
  select id into v_class from public.classes where enrol_token = p_enrol_token and enrol_open;
  if v_class is null then
    raise exception 'this enrolment link is closed or wrong; ask the teacher for a new one' using errcode = 'P0002';
  end if;
  perform public.check_trial_limits(v_class);
  perform public.check_nickname(v_class, p_nickname);
  insert into public.learners (nickname, grade, avatar, language)
  values (btrim(p_nickname), p_grade, coalesce(p_avatar, 'robot'), coalesce(p_language, 'en'))
  returning id into v_id;
  insert into public.learner_guardians (learner_id, user_id) values (v_id, v_user);
  insert into public.class_learners (class_id, learner_id) values (v_class, v_id);
  -- The name consent is recorded when the certificate service stores the name.
  perform public.give_consents(v_id, v_user, v_class, p_notice, false);
  return v_id;
end
$$;

/** A parent adds their child's existing profile to another class (spec FR-5b). */
create function public.link_child(p_enrol_token text, p_learner uuid, p_notice text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_class uuid; v_nick text;
begin
  if not public.is_guardian(p_learner) then
    raise exception 'only the child''s parent or guardian can do that' using errcode = '42501';
  end if;
  select id into v_class from public.classes where enrol_token = p_enrol_token and enrol_open;
  if v_class is null then
    raise exception 'this enrolment link is closed or wrong; ask the teacher for a new one' using errcode = 'P0002';
  end if;
  perform public.check_trial_limits(v_class);
  select nickname into v_nick from public.learners where id = p_learner;
  perform public.check_nickname(v_class, v_nick);
  insert into public.class_learners (class_id, learner_id) values (v_class, p_learner)
  on conflict do nothing;
  perform public.give_consents(p_learner, v_user, v_class, p_notice, false);
end
$$;

-- --- Enrolment by a school or club, confirmed by a parent (spec FR-5a) -------------------------

/** Called by the certificate service (service role) after it encrypted the name and contact. */
create function public.create_pending_enrolment(p_class uuid, p_requested_by uuid, p_grade int,
  p_name bytea, p_name_key int, p_contact bytea, p_contact_key int, p_token_hash text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.class_staff where class_id = p_class and user_id = p_requested_by) then
    raise exception 'only the class''s teacher or coach can enrol learners' using errcode = '42501';
  end if;
  perform public.check_trial_limits(p_class);
  insert into public.pending_enrolments (class_id, grade, certificate_name, certificate_name_key_version,
    parent_contact, parent_contact_key_version, confirm_token_hash, requested_by)
  values (p_class, p_grade, p_name, p_name_key, p_contact, p_contact_key, p_token_hash, p_requested_by)
  returning id into v_id;
  return v_id;
end
$$;

/**
 * The parent confirms with the secret from their link. A new profile is made, or the child's
 * existing profile is linked (FR-5b). The school's name is kept only if the parent agrees to (b).
 */
create function public.confirm_enrolment(p_token text, p_nickname text, p_avatar text,
  p_language text, p_notice text, p_keep_name boolean, p_existing uuid default null) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_adult();
  v_p public.pending_enrolments;
  v_id uuid;
begin
  select * into v_p from public.pending_enrolments
   where confirm_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and expires_at > now()
   for update;
  if not found then
    raise exception 'this confirmation link has expired or is wrong; ask the school or club to send it again' using errcode = 'P0002';
  end if;
  if p_existing is not null then
    if not public.is_guardian(p_existing) then
      raise exception 'only the child''s parent or guardian can link that profile' using errcode = '42501';
    end if;
    v_id := p_existing;
    perform public.check_nickname(v_p.class_id, (select nickname from public.learners where id = v_id));
    if p_keep_name then
      update public.learners
         set certificate_name = coalesce(certificate_name, v_p.certificate_name),
             certificate_name_key_version = case when certificate_name is null
               then v_p.certificate_name_key_version else certificate_name_key_version end
       where id = v_id;
    end if;
  else
    perform public.check_nickname(v_p.class_id, p_nickname);
    insert into public.learners (nickname, grade, avatar, language, certificate_name, certificate_name_key_version)
    values (btrim(p_nickname), v_p.grade, coalesce(p_avatar, 'robot'), coalesce(p_language, 'en'),
            case when p_keep_name then v_p.certificate_name end,
            case when p_keep_name then v_p.certificate_name_key_version end)
    returning id into v_id;
    insert into public.learner_guardians (learner_id, user_id) values (v_id, v_user);
  end if;
  insert into public.class_learners (class_id, learner_id) values (v_p.class_id, v_id)
  on conflict do nothing;
  perform public.give_consents(v_id, v_user, v_p.class_id, p_notice, p_keep_name);
  -- The pending entry (with the school's copy of the name and the contact) goes at once.
  delete from public.pending_enrolments where id = v_p.id;
  return v_id;
end
$$;

-- --- The certificate name (service role only, ADR-0015) ------------------------------------------

create function public.set_certificate_name(p_learner uuid, p_by uuid, p_name bytea, p_key int,
  p_notice text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.learner_guardians where learner_id = p_learner and user_id = p_by) then
    raise exception 'only the child''s parent or guardian can set the certificate name' using errcode = '42501';
  end if;
  update public.learners set certificate_name = p_name, certificate_name_key_version = p_key
   where id = p_learner;
  if not exists (select 1 from public.consents where learner_id = p_learner and control = 'name'
                 and withdrawn_at is null) then
    insert into public.consents (learner_id, user_id, control, notice_version)
    values (p_learner, p_by, 'name', p_notice);
  end if;
end
$$;

/** Which learners have a certificate name (the batch screen shows it, never the name itself). */
create function public.has_certificate_name(p_learner uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not (public.is_guardian(p_learner) or public.staff_sees_learner(p_learner)) then
    raise exception 'not your learner' using errcode = '42501';
  end if;
  return (select certificate_name is not null from public.learners where id = p_learner);
end
$$;

-- --- Withdrawing and deleting (spec FR-9, §7.5) ------------------------------------------------

create function public.withdraw_consent(p_learner uuid, p_control public.consent_control,
  p_class uuid default null) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_guardian(p_learner) then
    raise exception 'only the child''s parent or guardian can withdraw consent' using errcode = '42501';
  end if;
  if p_control = 'record' then
    -- (a) withdrawn: the learner and everything recorded about them goes.
    delete from public.learners where id = p_learner;
    return;
  end if;
  update public.consents set withdrawn_at = now()
   where learner_id = p_learner and control = p_control and withdrawn_at is null
     and (p_class is null or class_id = p_class);
  if p_control = 'name' then
    update public.learners set certificate_name = null, certificate_name_key_version = null
     where id = p_learner;
  elsif p_control = 'class' then
    delete from public.class_learners where learner_id = p_learner
      and (p_class is null or class_id = p_class);
  end if;
end
$$;

create function public.delete_learner(p_learner uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_guardian(p_learner) then
    raise exception 'only the child''s parent or guardian can delete the profile' using errcode = '42501';
  end if;
  delete from public.learners where id = p_learner;
end
$$;

-- --- Learner sign-in (service role: the sign-in Worker, ADR-0013) -------------------------------

/** The sign-in screen's list: nickname and avatar of each consented learner in the class. */
create function public.sign_in_roster(p_class_code text)
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
   order by lower(l.nickname)
$$;

/** Records a PIN attempt: 5 wrong tries lock the learner for 5 minutes. Returns true if allowed. */
create function public.record_pin_attempt(p_learner uuid, p_ok boolean) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_locked timestamptz;
begin
  select locked_until into v_locked from public.learners where id = p_learner for update;
  if v_locked is not null and v_locked > now() then return false; end if;
  if p_ok then
    update public.learners set pin_failures = 0, locked_until = null where id = p_learner;
    return true;
  end if;
  update public.learners
     set pin_failures = pin_failures + 1,
         locked_until = case when pin_failures + 1 >= 5 then now() + interval '5 minutes' end
   where id = p_learner;
  return false;
end
$$;

create function public.set_learner_pin(p_learner uuid, p_hash text) returns void
language sql security definer
set search_path = ''
as $$
  update public.learners set pin_hash = p_hash, pin_failures = 0, locked_until = null
   where id = p_learner
$$;

/** A teacher, coach or parent resets a forgotten PIN; the learner picks a new one. */
create function public.reset_learner_pin(p_learner uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not (public.is_guardian(p_learner) or public.staff_sees_learner(p_learner)) then
    raise exception 'only the learner''s teacher, coach or parent can reset the PIN' using errcode = '42501';
  end if;
  update public.learners set pin_hash = null, pin_failures = 0, locked_until = null where id = p_learner;
end
$$;

-- --- Records, badges and certificates ----------------------------------------------------------

/** Spot-check (spec FR-15): mark a record checked, or revoke a wrong one. */
create function public.check_record(p_record text, p_revoke boolean default false) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_learner uuid;
begin
  select learner_id into v_learner from public.sheet_records where id = p_record;
  if v_learner is null or not public.staff_sees_learner(v_learner) then
    raise exception 'only the learner''s teacher or coach can check records' using errcode = '42501';
  end if;
  if p_revoke then
    update public.sheet_records set revoked_by = v_user, revoked_at = now() where id = p_record;
  else
    update public.sheet_records set checked_by = v_user, checked_at = now() where id = p_record;
  end if;
end
$$;

/** Awarded automatically by the badge service (service role) when a rule is met (FR-19a). */
create function public.award_badge(p_learner uuid, p_badge text, p_rule_version text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.has_consent(p_learner, 'record') then
    raise exception 'no learning-record consent for this learner' using errcode = '42501';
  end if;
  insert into public.badge_awards (learner_id, badge_id, rule_version)
  values (p_learner, p_badge, p_rule_version)
  on conflict (learner_id, badge_id) do nothing
  returning id into v_id;
  return v_id;
end
$$;

create function public.revoke_badge(p_award uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_learner uuid;
begin
  select learner_id into v_learner from public.badge_awards where id = p_award;
  if v_learner is null or not public.staff_sees_learner(v_learner) then
    raise exception 'only the learner''s teacher or coach can revoke a badge' using errcode = '42501';
  end if;
  update public.badge_awards set revoked_by = v_user, revoked_at = now() where id = p_award;
  update public.certificate_codes set revoked_at = now()
   where badge_award_id = p_award and revoked_at is null;
end
$$;

/** The certificate service (service role) records each certificate's verification code. */
create function public.issue_certificate_code(p_award uuid, p_label text) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_badge text;
begin
  select badge_id into v_badge from public.badge_awards where id = p_award and revoked_at is null;
  if v_badge is null then raise exception 'no such badge, or it was revoked' using errcode = 'P0002'; end if;
  loop
    v_code := 'RFA-';
    for i in 1..6 loop
      if i = 5 then v_code := v_code || '-'; end if;
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.certificate_codes where code = v_code);
  end loop;
  insert into public.certificate_codes (code, badge_award_id, badge_id, issued_by_label)
  values (v_code, p_award, v_badge, p_label);
  return v_code;
end
$$;

/** Anyone can check a code (spec FR-29): badge, date and issuer, never a name or nickname. */
create function public.verify_certificate(p_code text)
returns table (badge_id text, issued_on date, issued_by_label text, valid boolean)
language sql stable security definer
set search_path = ''
as $$
  select badge_id, issued_on, issued_by_label, revoked_at is null
    from public.certificate_codes where code = upper(btrim(p_code))
$$;

-- --- Keeping data only while it is needed (spec §7.5; run daily by a Worker, service role) ------

create function public.expire_pending_enrolments() returns int
language sql security definer
set search_path = ''
as $$
  with gone as (delete from public.pending_enrolments where expires_at <= now() returning 1)
  select count(*)::int from gone
$$;

/** Adults to message today: 10 months without signing in (then 11), one message each 30 days. */
create function public.dormancy_notices_due()
returns table (user_id uuid, months int)
language sql stable security definer
set search_path = ''
as $$
  select a.user_id, 10 + a.dormancy_notices
    from public.adults a
   where a.dormancy_notices < 2
     and a.last_seen_at <= now() - interval '10 months' - (a.dormancy_notices * interval '30 days')
$$;

create function public.dormancy_notice_sent(p_user uuid) returns void
language sql security definer
set search_path = ''
as $$
  update public.adults set dormancy_notices = dormancy_notices + 1 where user_id = p_user
$$;

/**
 * At 12 months: deletes dormant adults, and with them every learner they hold that is in no
 * current class and has no other guardian who is still active. Returns how many adults went.
 */
create function public.delete_dormant_accounts() returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_count int;
begin
  create temporary table dormant on commit drop as
    select user_id from public.adults where last_seen_at <= now() - interval '12 months';
  delete from public.learners l
   where exists (select 1 from public.learner_guardians g join dormant d on d.user_id = g.user_id
                  where g.learner_id = l.id)
     and not exists (select 1 from public.learner_guardians g
                      where g.learner_id = l.id and g.user_id not in (select user_id from dormant))
     and not exists (select 1 from public.class_learners cl where cl.learner_id = l.id);
  delete from auth.users where id in (select user_id from dormant);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- --- Who may call what ------------------------------------------------------------------------

revoke all on function
  public.require_adult(), public.random_class_code(), public.random_token(),
  public.check_trial_limits(uuid), public.check_nickname(uuid, text, uuid),
  public.give_consents(uuid, uuid, uuid, text, boolean),
  public.create_pending_enrolment(uuid, uuid, int, bytea, int, bytea, int, text),
  public.set_certificate_name(uuid, uuid, bytea, int, text),
  public.sign_in_roster(text), public.record_pin_attempt(uuid, boolean),
  public.set_learner_pin(uuid, text), public.award_badge(uuid, text, text),
  public.issue_certificate_code(uuid, text), public.expire_pending_enrolments(),
  public.dormancy_notices_due(), public.dormancy_notice_sent(uuid), public.delete_dormant_accounts()
from public, anon, authenticated;

grant execute on function
  public.create_pending_enrolment(uuid, uuid, int, bytea, int, bytea, int, text),
  public.set_certificate_name(uuid, uuid, bytea, int, text),
  public.sign_in_roster(text), public.record_pin_attempt(uuid, boolean),
  public.set_learner_pin(uuid, text), public.award_badge(uuid, text, text),
  public.issue_certificate_code(uuid, text), public.expire_pending_enrolments(),
  public.dormancy_notices_due(), public.dormancy_notice_sent(uuid), public.delete_dormant_accounts()
to service_role;

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated, service_role;

-- The Workers (service role) read what they need to sign learners in, award badges and draw
-- certificates (the certificate service decrypts names, ADR-0015); every write is a function.
grant select on public.organisations, public.organisation_staff, public.classes, public.class_staff,
  public.learners, public.learner_guardians, public.class_learners, public.consents,
  public.sheet_records, public.badge_awards to service_role;
