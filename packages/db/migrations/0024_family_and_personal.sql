-- Family groups and personal learners (docs/specs/M5-family-and-personal.md v0.3, approved
-- 2026-11-25). A family group is an organisation of kind 'family' with one class, owned by a
-- parent, holding only that parent's own children (at most 8). A personal learner is an adult's
-- own learner profile, in no group.
-- The family rules are enforced by triggers on the tables, so no other route (school enrolment,
-- staff invitations, sign-in cards, checks, verification) can get round them.
-- Note: 'family' is compared as text in this file; a new enum value can't be used as a literal in
-- the transaction that adds it.

alter type public.organisation_kind add value if not exists 'family';

-- Schools need an EMIS number; clubs and families don't.
alter table public.organisations drop constraint organisations_check;
alter table public.organisations add constraint organisations_emis_for_schools
  check (kind::text <> 'school' or emis is not null);

alter table public.learners
  add column self_user_id uuid unique references auth.users (id) on delete cascade;

create function public.is_family_org(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.organisations where id = p_org and kind::text = 'family')
$$;

create function public.is_family_class(p_class uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes c join public.organisations o on o.id = c.organisation_id
                  where c.id = p_class and o.kind::text = 'family')
$$;

/** The caller's family group class, or null. */
create function public.my_family_class() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id from public.classes c
    join public.organisations o on o.id = c.organisation_id
    join public.organisation_staff s on s.organisation_id = o.id
   where o.kind::text = 'family' and s.user_id = public.current_adult()
   limit 1
$$;

-- A second parent or guardian joins by a one-time link the first one confirms (FF-7).
create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete cascade,
  accepted_at timestamptz,
  confirmed_at timestamptz
);
alter table public.family_invitations enable row level security;
revoke all on public.family_invitations from anon, authenticated;
create policy owner on public.family_invitations for select to authenticated
  using (public.is_org_staff(organisation_id, true));
grant select (id, organisation_id, created_at, expires_at, accepted_at, confirmed_at)
  on public.family_invitations to authenticated;

-- --- The family rules, on the tables --------------------------------------------------------

create function public.family_guard_class() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.is_family_org(new.organisation_id) then
    -- No enrolment link and no "needs a check" (FF-2, FF-5).
    new.enrol_open := false;
    new.badges_need_check := false;
    if tg_op = 'INSERT' and exists (select 1 from public.classes where organisation_id = new.organisation_id) then
      raise exception 'a family group has one class' using errcode = '54000';
    end if;
  end if;
  return new;
end
$$;
create trigger family_guard before insert or update on public.classes
  for each row execute function public.family_guard_class();

create function public.family_guard_organisation() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.kind::text = 'family' and new.verified_at is not null then
    raise exception 'family groups are not verified' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger family_guard before update on public.organisations
  for each row execute function public.family_guard_organisation();

create function public.family_guard_by_class() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.is_family_class(new.class_id) then
    raise exception 'family groups have no % (only the family''s own children join)', tg_argv[0]
      using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger family_guard before insert on public.sign_in_cards
  for each row execute function public.family_guard_by_class('sign-in cards');
create trigger family_guard before insert on public.pending_enrolments
  for each row execute function public.family_guard_by_class('school enrolments');

create function public.family_guard_invitation() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.is_family_org(new.organisation_id) then
    raise exception 'family groups have no staff (invite a second parent instead)' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger family_guard before insert on public.staff_invitations
  for each row execute function public.family_guard_invitation();

create function public.family_guard_staff() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.is_family_org(new.organisation_id)
     and exists (select 1 from public.organisation_staff where organisation_id = new.organisation_id)
     and not exists (select 1 from public.family_invitations
                      where organisation_id = new.organisation_id and accepted_by = new.user_id
                        and confirmed_at is not null) then
    raise exception 'only a confirmed second parent or guardian joins a family group' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger family_guard before insert on public.organisation_staff
  for each row execute function public.family_guard_staff();

create function public.family_guard_learner() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.is_family_class(new.class_id) then
    if (select count(*) from public.class_learners where class_id = new.class_id) >= 8 then
      raise exception 'a family group has at most 8 children; more is a club' using errcode = '54000';
    end if;
    if not exists (select 1 from public.learner_guardians g
                     join public.class_staff s on s.user_id = g.user_id and s.class_id = new.class_id
                    where g.learner_id = new.learner_id) then
      raise exception 'only the family''s own children join a family group' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
create trigger family_guard before insert on public.class_learners
  for each row execute function public.family_guard_learner();

/** A check mark comes only from a teacher or coach of a school or club class of the learner (FF-5). */
create function public.family_guard_check() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.checked_at is not null and old.checked_at is null and not exists (
       select 1 from public.class_learners cl
         join public.class_staff s on s.class_id = cl.class_id
         join public.classes c on c.id = cl.class_id
         join public.organisations o on o.id = c.organisation_id
        where cl.learner_id = new.learner_id and s.user_id = new.checked_by
          and o.kind::text <> 'family') then
    raise exception 'only a school or club teacher or coach can mark a record checked' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger family_guard before update on public.sheet_records
  for each row execute function public.family_guard_check();

-- --- Family groups ------------------------------------------------------------------------------

/** Starts the caller's family group (or returns the one they have). Returns its class. */
create function public.create_family_group(p_language text default 'en') returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_org uuid; v_class uuid := public.my_family_class();
begin
  if v_class is not null then return v_class; end if;
  insert into public.organisations (kind, name, registered)
  values ('family', 'Family group', false) returning id into v_org;
  insert into public.organisation_staff (organisation_id, user_id, role) values (v_org, v_user, 'admin');
  insert into public.classes (organisation_id, name, grade_band, language, class_code, enrol_token, created_by)
  values (v_org, 'Family', 'mixed', coalesce(p_language, 'en'), public.random_class_code(),
          public.random_token(), v_user)
  returning id into v_class;
  insert into public.class_staff (class_id, user_id) values (v_class, v_user);
  return v_class;
end
$$;

/** A new child, straight into the caller's family group (the same consents as FR-6 to FR-10). */
create function public.enrol_into_family(p_nickname text, p_grade int, p_avatar text,
  p_language text, p_notice text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_class uuid := public.my_family_class(); v_id uuid;
begin
  if v_class is null then
    raise exception 'start a family group first' using errcode = 'P0002';
  end if;
  perform public.check_nickname(v_class, p_nickname);
  insert into public.learners (nickname, grade, avatar, language)
  values (btrim(p_nickname), p_grade, coalesce(p_avatar, 'robot'), coalesce(p_language, 'en'))
  returning id into v_id;
  insert into public.learner_guardians (learner_id, user_id) values (v_id, v_user);
  insert into public.class_learners (class_id, learner_id) values (v_class, v_id);
  perform public.give_consents(v_id, v_user, v_class, p_notice, false);
  return v_id;
end
$$;

/** A child the caller already enrolled elsewhere joins the family group too (one profile, FR-31). */
create function public.add_to_family(p_learner uuid, p_notice text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_class uuid := public.my_family_class(); v_nick text;
begin
  if v_class is null then
    raise exception 'start a family group first' using errcode = 'P0002';
  end if;
  if not public.is_guardian(p_learner) then
    raise exception 'only your own children join your family group' using errcode = '42501';
  end if;
  select nickname into v_nick from public.learners where id = p_learner;
  perform public.check_nickname(v_class, v_nick);
  insert into public.class_learners (class_id, learner_id) values (v_class, p_learner)
  on conflict do nothing;
  perform public.give_consents(p_learner, v_user, v_class, p_notice, false);
end
$$;

/** The first parent makes a one-time link for a second parent or guardian (FF-7). */
create function public.create_guardian_invitation() returns text
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_class uuid := public.my_family_class();
  v_org uuid; v_token text := public.random_token() || public.random_token();
begin
  select organisation_id into v_org from public.classes where id = v_class;
  if v_org is null or not public.is_org_staff(v_org, true) then
    raise exception 'start a family group first' using errcode = 'P0002';
  end if;
  insert into public.family_invitations (organisation_id, token_hash, created_by)
  values (v_org, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_user);
  return v_token;
end
$$;

/** The second parent opens the link (signed in); they join once the first parent confirms. */
create function public.accept_guardian_invitation(p_token text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult();
begin
  update public.family_invitations set accepted_by = v_user, accepted_at = now()
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and accepted_by is null and expires_at > now();
  if not found then
    raise exception 'this link has expired or was already used; ask for a new one' using errcode = 'P0002';
  end if;
end
$$;

/** The first parent confirms: the second becomes a guardian of every child in the group. */
create function public.confirm_guardian(p_invitation uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_inv public.family_invitations; v_class uuid;
begin
  perform public.require_adult();
  select * into v_inv from public.family_invitations where id = p_invitation for update;
  if v_inv.id is null or not public.is_org_staff(v_inv.organisation_id, true) then
    raise exception 'only the family group''s parent can confirm' using errcode = '42501';
  end if;
  if v_inv.accepted_by is null or v_inv.confirmed_at is not null then
    raise exception 'nobody is waiting on that link' using errcode = 'P0002';
  end if;
  update public.family_invitations set confirmed_at = now() where id = p_invitation;
  select id into v_class from public.classes where organisation_id = v_inv.organisation_id;
  insert into public.organisation_staff (organisation_id, user_id, role)
  values (v_inv.organisation_id, v_inv.accepted_by, 'admin') on conflict do nothing;
  insert into public.class_staff (class_id, user_id) values (v_class, v_inv.accepted_by)
  on conflict do nothing;
  insert into public.learner_guardians (learner_id, user_id)
  select cl.learner_id, v_inv.accepted_by from public.class_learners cl where cl.class_id = v_class
  on conflict do nothing;
end
$$;

-- --- Personal learners -------------------------------------------------------------------------

/** An adult's own learner profile (FP-1 to FP-3): 18 or older, their own consent, no group. */
create function public.create_personal_learner(p_nickname text, p_avatar text, p_language text,
  p_notice text, p_adult boolean) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_id uuid;
begin
  if p_adult is not true then
    raise exception 'learning yourself is for people 18 or older; a parent can start a family group' using errcode = '22023';
  end if;
  select id into v_id from public.learners where self_user_id = v_user;
  if v_id is not null then return v_id; end if;
  if length(btrim(coalesce(p_nickname, ''))) not between 2 and 20 then
    raise exception 'a nickname has 2 to 20 letters' using errcode = '22023';
  end if;
  insert into public.learners (nickname, grade, avatar, language, self_user_id)
  values (btrim(p_nickname), 12, coalesce(p_avatar, 'robot'), coalesce(p_language, 'en'), v_user)
  returning id into v_id;
  insert into public.learner_guardians (learner_id, user_id) values (v_id, v_user);
  insert into public.consents (learner_id, user_id, control, notice_version)
  values (v_id, v_user, 'record', p_notice);
  return v_id;
end
$$;

/** For "Learn as <child>" and a personal learner's own session: the learner's session version,
 *  for a parent or guardian (or the adult themselves) only. The sign-in service calls this as the
 *  adult, then signs the learner's session. */
create function public.guardian_learner_session(p_learner uuid)
returns table (learner_id uuid, nickname text, avatar text, session_version int)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_guardian(p_learner) or not public.has_consent(p_learner, 'record') then
    raise exception 'only the child''s parent or guardian can do that' using errcode = '42501';
  end if;
  return query select l.id, l.nickname, l.avatar, l.session_version
                 from public.learners l where l.id = p_learner;
end
$$;

-- --- Certificates: family groups name no organisation (FC-1) ------------------------------------

create or replace function public.certificate_label(p_learner uuid) returns text
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
       and o.kind::text <> 'family'
     order by r.checked_at desc limit 1
  ), latest as (
    select o.name, o.verified_at, cl.joined_at as at
      from public.class_learners cl
      join public.classes c on c.id = cl.class_id
      join public.organisations o on o.id = c.organisation_id
     where cl.learner_id = p_learner and o.kind::text <> 'family'
     order by cl.joined_at desc limit 1
  )
  select coalesce(
    (select name || case when verified_at is null then ' (not yet verified)' else '' end
       from (select * from checked union all select * from latest) x limit 1),
    'Robots For All')
$$;

revoke all on function public.is_family_org(uuid), public.is_family_class(uuid)
  from public, anon, authenticated;
revoke all on function public.my_family_class(), public.create_family_group(text),
  public.enrol_into_family(text, int, text, text, text), public.add_to_family(uuid, text),
  public.create_guardian_invitation(), public.accept_guardian_invitation(text),
  public.confirm_guardian(uuid), public.create_personal_learner(text, text, text, text, boolean),
  public.guardian_learner_session(uuid)
  from public, anon;
grant execute on function public.my_family_class(), public.create_family_group(text),
  public.enrol_into_family(text, int, text, text, text), public.add_to_family(uuid, text),
  public.create_guardian_invitation(), public.accept_guardian_invitation(text),
  public.confirm_guardian(uuid), public.create_personal_learner(text, text, text, text, boolean),
  public.guardian_learner_session(uuid)
  to authenticated;
