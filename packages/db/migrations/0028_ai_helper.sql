-- The AI helper (M6 spec v0.3, ADR-0018), step 2: who may ask, caps, the platform's monthly
-- question cap and budget, the parent's consent control (e), the class switch, Common questions
-- and their thumbs-down, and the back office's settings and totals.
-- No question or answer text is ever stored. Usage is kept per person per day for 31 days; the
-- back office sees only daily totals without ids.
-- consent_control gets a new value here; a value added in a transaction can't be used in it, so
-- the functions below compare it as text and are written in plpgsql (checked when called).

alter type public.consent_control add value if not exists 'ai_helper';

-- FR-6 (b): a class's teachers and coaches can stop its learners asking; on by default.
alter table public.classes add column helper_allowed boolean not null default true;

-- --- Settings (back office, AI → Helper settings) ---------------------------------------------

create table public.helper_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  children_enabled boolean not null default false,
  adult_daily int not null default 20 check (adult_daily between 0 and 200),
  child_daily int not null default 5 check (child_daily between 0 and 50),
  class_daily_per_learner int not null default 5 check (class_daily_per_learner between 0 and 50),
  month_questions int not null default 20000 check (month_questions >= 0),
  month_budget_cents int not null default 50000 check (month_budget_cents >= 0),
  refusals_to_pause int not null default 3 check (refusals_to_pause between 1 and 20),
  adult_model text not null default 'claude-haiku-5-5' check (adult_model ~ '^[a-z0-9._:/-]{2,80}$'),
  child_model text not null default 'claude-haiku-5-5' check (child_model ~ '^[a-z0-9._:/-]{2,80}$'),
  faq_model text not null default 'claude-haiku-5-5' check (faq_model ~ '^[a-z0-9._:/-]{2,80}$'),
  adult_prompt text not null default 'adult-v1' check (adult_prompt ~ '^[a-z]+-v[0-9]+$'),
  child_prompt text not null default 'child-v1' check (child_prompt ~ '^[a-z]+-v[0-9]+$'),
  faq_prompt text not null default 'faq-v1' check (faq_prompt ~ '^[a-z]+-v[0-9]+$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.helper_settings (id) values (1);

-- --- Usage --------------------------------------------------------------------------------------

/** Per adult or learner per day (South African days), for caps and pausing; 31 days. */
create table public.helper_usage (
  subject uuid not null,
  day date not null,
  asked int not null default 0,
  refused int not null default 0,
  primary key (subject, day)
);

create table public.helper_class_usage (
  class_id uuid not null references public.classes (id) on delete cascade,
  day date not null,
  asked int not null default 0,
  primary key (class_id, day)
);

/** The platform's month: questions (cap) and estimated spend (budget), Common questions included. */
create table public.helper_month (
  month date primary key check (extract(day from month) = 1),
  questions int not null default 0,
  spend_cents int not null default 0
);

/** Daily totals for the back office: no ids, kept. */
create table public.helper_day_totals (
  day date not null,
  audience text not null check (audience in ('adult', 'child', 'faq')),
  asked int not null default 0,
  refused int not null default 0,
  blocked int not null default 0,
  thumbs_up int not null default 0,
  thumbs_down int not null default 0,
  primary key (day, audience)
);

-- --- Common questions (FR-15 to FR-19): AI-drafted, no human review -----------------------------

create table public.helper_faq (
  lesson_id text not null check (lesson_id ~ '^[a-z0-9-]{3,60}$'),
  language text not null check (language ~ '^[a-z]{2,3}$'),
  -- [{"q": "...", "a": "..."}], 5 to 8 of them.
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 8),
  model text not null,
  prompt_version text not null,
  lesson_hash text not null check (lesson_hash ~ '^[0-9a-f]{8,64}$'),
  made_at timestamptz not null default now(),
  primary key (lesson_id, language)
);

/** One thumbs-down per person per answer; 3 hide it (FR-17). Cleared when redrafted. */
create table public.helper_faq_votes (
  lesson_id text not null,
  language text not null,
  item int not null check (item between 0 and 7),
  subject uuid not null,
  primary key (lesson_id, language, item, subject),
  foreign key (lesson_id, language) references public.helper_faq (lesson_id, language) on delete cascade
);

alter table public.helper_settings enable row level security;
alter table public.helper_usage enable row level security;
alter table public.helper_class_usage enable row level security;
alter table public.helper_month enable row level security;
alter table public.helper_day_totals enable row level security;
alter table public.helper_faq enable row level security;
alter table public.helper_faq_votes enable row level security;
-- No policies: every read and write goes through the functions below.

-- --- Helpers ------------------------------------------------------------------------------------

create function public.helper_today() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Africa/Johannesburg')::date $$;

create function public.helper_count_day(p_audience text, p_asked int, p_refused int,
  p_blocked int, p_up int, p_down int) returns void
language sql
set search_path = ''
as $$
  insert into public.helper_day_totals as t (day, audience, asked, refused, blocked, thumbs_up, thumbs_down)
  values (public.helper_today(), p_audience, p_asked, p_refused, p_blocked, p_up, p_down)
  on conflict (day, audience) do update
    set asked = t.asked + excluded.asked, refused = t.refused + excluded.refused,
        blocked = t.blocked + excluded.blocked, thumbs_up = t.thumbs_up + excluded.thumbs_up,
        thumbs_down = t.thumbs_down + excluded.thumbs_down
$$;

/** Whether a child's parent turned on the AI helper (control e). */
create function public.has_helper_consent(p_learner uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (select 1 from public.consents c
    where c.learner_id = p_learner and c.control::text = 'ai_helper' and c.withdrawn_at is null);
end
$$;

-- --- Asking (the helper Worker, with the service key, after checking the session) -------------

/**
 * One question: checks the switches, the child's consent and classes, the caps, the pause and
 * the platform's month, and counts it, all at once. p_adult or p_learner is the asker the Worker
 * has already checked. Returns whether to go ahead, why not, the audience, the child's grade band
 * and the nicknames to strip from the question (FR-6 to FR-9, FR-20, FR-21, §7.1).
 */
create function public.helper_take(p_adult uuid, p_learner uuid, p_on_lesson boolean)
returns table (allowed boolean, reason text, audience text, grade_band text, names text[])
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.helper_settings;
  v_subject uuid := coalesce(p_adult, p_learner);
  v_audience text := case when p_adult is not null then 'adult' else 'child' end;
  v_day date := public.helper_today();
  v_month date := date_trunc('month', v_day)::date;
  v_used public.helper_usage;
  v_m public.helper_month;
  v_grade int;
  v_band text;
  v_names text[];
  v_class record;
  v_cap int;
begin
  if (p_adult is null) = (p_learner is null) then
    raise exception 'one asker: an adult or a learner' using errcode = '22023';
  end if;
  select * into s from public.helper_settings where id = 1;
  if not s.enabled then
    return query select false, 'off', v_audience, null::text, null::text[]; return;
  end if;
  if p_adult is not null and not exists (
       select 1 from public.adults a where a.user_id = p_adult
          and (a.locked_until is null or a.locked_until < now())) then
    return query select false, 'no_account', v_audience, null::text, null::text[]; return;
  end if;

  if p_learner is not null then
    if not s.children_enabled then
      return query select false, 'children_off', v_audience, null::text, null::text[]; return;
    end if;
    if not coalesce(p_on_lesson, false) then
      return query select false, 'lesson_only', v_audience, null::text, null::text[]; return;
    end if;
    select l.grade into v_grade from public.learners l where l.id = p_learner;
    if v_grade is null or not public.has_consent(p_learner, 'record')
       or not public.has_helper_consent(p_learner) then
      return query select false, 'no_consent', v_audience, null::text, null::text[]; return;
    end if;
    -- The stricter class wins: any class with the switch off stops it.
    if exists (select 1 from public.class_learners cl join public.classes c on c.id = cl.class_id
                where cl.learner_id = p_learner and not c.helper_allowed) then
      return query select false, 'class_off', v_audience, null::text, null::text[]; return;
    end if;
    -- Each class's own daily cap.
    for v_class in
      select c.id, (select count(*) from public.class_learners x where x.class_id = c.id) as size
        from public.class_learners cl join public.classes c on c.id = cl.class_id
       where cl.learner_id = p_learner
    loop
      if coalesce((select u.asked from public.helper_class_usage u
                    where u.class_id = v_class.id and u.day = v_day), 0)
         >= v_class.size * s.class_daily_per_learner then
        return query select false, 'class_cap', v_audience, null::text, null::text[]; return;
      end if;
    end loop;
    v_band := case when v_grade <= 4 then '3-4' when v_grade <= 6 then '5-6' else '7-9' end;
  end if;

  select * into v_used from public.helper_usage u where u.subject = v_subject and u.day = v_day;
  if coalesce(v_used.refused, 0) >= s.refusals_to_pause then
    return query select false, 'paused', v_audience, v_band, null::text[]; return;
  end if;
  v_cap := s.child_daily;
  if p_adult is not null then v_cap := s.adult_daily; end if;
  if coalesce(v_used.asked, 0) >= v_cap then
    return query select false, 'daily_cap', v_audience, v_band, null::text[]; return;
  end if;
  select * into v_m from public.helper_month m where m.month = v_month;
  if coalesce(v_m.questions, 0) >= s.month_questions then
    return query select false, 'month_cap', v_audience, v_band, null::text[]; return;
  end if;
  if coalesce(v_m.spend_cents, 0) >= s.month_budget_cents then
    return query select false, 'budget', v_audience, v_band, null::text[]; return;
  end if;

  -- Count it.
  insert into public.helper_usage as u (subject, day, asked) values (v_subject, v_day, 1)
  on conflict (subject, day) do update set asked = u.asked + 1;
  insert into public.helper_month as m (month, questions) values (v_month, 1)
  on conflict (month) do update set questions = m.questions + 1;
  if p_learner is not null then
    insert into public.helper_class_usage as u (class_id, day, asked)
      select cl.class_id, v_day, 1 from public.class_learners cl where cl.learner_id = p_learner
    on conflict (class_id, day) do update set asked = u.asked + 1;
  end if;
  perform public.helper_count_day(v_audience, 1, 0, 0, 0, 0);

  -- Nicknames to strip: an adult's children and the learners in their classes; a child's own
  -- and their classmates'.
  if p_adult is not null then
    select coalesce(array_agg(distinct l.nickname), '{}') into v_names from public.learners l
     where exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = p_adult)
        or exists (select 1 from public.class_learners cl join public.class_staff cs on cs.class_id = cl.class_id
                    where cl.learner_id = l.id and cs.user_id = p_adult);
  else
    select coalesce(array_agg(distinct l.nickname), '{}') into v_names from public.learners l
     where l.id = p_learner or exists (
       select 1 from public.class_learners a join public.class_learners b on b.class_id = a.class_id
        where a.learner_id = p_learner and b.learner_id = l.id);
  end if;
  return query select true, null::text, v_audience, v_band, v_names;
end
$$;

/** After the answer: a refusal or a blocked answer, and its estimated cost (FR-9, FR-20, FR-21). */
create function public.helper_record(p_subject uuid, p_audience text, p_refused boolean,
  p_blocked boolean, p_cost_cents int) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_month date := date_trunc('month', public.helper_today())::date;
begin
  if p_audience not in ('adult', 'child', 'faq') then
    raise exception 'audience?' using errcode = '22023';
  end if;
  if p_subject is not null and p_refused then
    insert into public.helper_usage as u (subject, day, refused)
      values (p_subject, public.helper_today(), 1)
    on conflict (subject, day) do update set refused = u.refused + 1;
  end if;
  insert into public.helper_month as m (month, spend_cents) values (v_month, greatest(p_cost_cents, 0))
  on conflict (month) do update set spend_cents = m.spend_cents + excluded.spend_cents;
  perform public.helper_count_day(p_audience, 0, case when p_refused then 1 else 0 end,
    case when p_blocked then 1 else 0 end, 0, 0);
end
$$;

/** 👍 or 👎 on an answer: counts only, no text, no id (FR-5). */
create function public.helper_thumb(p_audience text, p_up boolean) returns void
language sql security definer
set search_path = ''
as $$
  select public.helper_count_day(p_audience, 0, 0, 0,
    case when p_up then 1 else 0 end, case when p_up then 0 else 1 end)
$$;

/** For the daily job: the month so far, to email the back office at 80% and 100%. */
create function public.helper_month_status()
returns table (questions int, spend_cents int, month_questions int, month_budget_cents int)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(m.questions, 0), coalesce(m.spend_cents, 0), s.month_questions, s.month_budget_cents
    from public.helper_settings s
    left join public.helper_month m on m.month = date_trunc('month', public.helper_today())::date
   where s.id = 1
$$;

/** The settings the Worker needs (models and prompts per audience, switches). */
create function public.helper_config() returns public.helper_settings
language sql stable security definer
set search_path = ''
as $$ select * from public.helper_settings where id = 1 $$;

/** Usage older than 31 days goes (daily job). Totals without ids stay. */
create function public.helper_cleanup() returns int
language plpgsql security definer
set search_path = ''
as $$
declare v int; w int;
begin
  delete from public.helper_usage where day < public.helper_today() - 31;
  get diagnostics v = row_count;
  delete from public.helper_class_usage where day < public.helper_today() - 31;
  get diagnostics w = row_count;
  return v + w;
end
$$;

-- --- Common questions ---------------------------------------------------------------------------

/** Lessons' Common questions as stored: which need (re)drafting (daily job). */
create function public.helper_faq_state()
returns table (lesson_id text, language text, lesson_hash text, prompt_version text, hidden int)
language sql stable security definer
set search_path = ''
as $$
  select f.lesson_id, f.language, f.lesson_hash, f.prompt_version,
         (select count(*)::int from (
            select v.item from public.helper_faq_votes v
             where v.lesson_id = f.lesson_id and v.language = f.language
             group by v.item having count(*) >= 3) h)
    from public.helper_faq f
$$;

/** Stores (or replaces) a lesson's Common questions after the automatic check; votes start again. */
create function public.helper_faq_store(p_lesson text, p_language text, p_items jsonb,
  p_model text, p_prompt text, p_hash text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.helper_faq_votes where lesson_id = p_lesson and language = p_language;
  insert into public.helper_faq (lesson_id, language, items, model, prompt_version, lesson_hash)
  values (p_lesson, p_language, p_items, p_model, p_prompt, p_hash)
  on conflict (lesson_id, language) do update
    set items = excluded.items, model = excluded.model, prompt_version = excluded.prompt_version,
        lesson_hash = excluded.lesson_hash, made_at = now();
end
$$;

/** A lesson's Common questions without the hidden ones (3 or more 👎), with each item's number. */
create function public.helper_faq_for(p_lesson text, p_language text)
returns table (item int, q text, a text)
language sql stable security definer
set search_path = ''
as $$
  select (e.n - 1)::int, e.value ->> 'q', e.value ->> 'a'
    from public.helper_faq f,
         jsonb_array_elements(f.items) with ordinality as e(value, n)
   where f.lesson_id = p_lesson and f.language = p_language
     and (select count(*) from public.helper_faq_votes v
           where v.lesson_id = f.lesson_id and v.language = f.language and v.item = e.n - 1) < 3
   order by e.n
$$;

/** One 👎 per signed-in person per answer; returns true if the answer is now hidden. */
create function public.helper_faq_down(p_lesson text, p_language text, p_item int, p_subject uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.helper_faq_votes (lesson_id, language, item, subject)
  values (p_lesson, p_language, p_item, p_subject) on conflict do nothing;
  if found then perform public.helper_count_day('faq', 0, 0, 0, 0, 1); end if;
  return (select count(*) >= 3 from public.helper_faq_votes
           where lesson_id = p_lesson and language = p_language and item = p_item);
end
$$;

-- --- The parent's control (e) and the class switch ---------------------------------------------

/** A parent or guardian turns the AI helper on or off for their child (FR-6 a). */
create function public.set_helper_consent(p_learner uuid, p_on boolean, p_notice text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult();
begin
  if not public.is_guardian(p_learner) then
    raise exception 'only the child''s parent or guardian can change that' using errcode = '42501';
  end if;
  if p_on then
    if coalesce(p_notice, '') !~ '^[0-9]+(\.[0-9]+)*$' then
      raise exception 'notice version?' using errcode = '22023';
    end if;
    if not public.has_helper_consent(p_learner) then
      insert into public.consents (learner_id, user_id, control, notice_version)
      values (p_learner, v_user, 'ai_helper'::text::public.consent_control, p_notice);
    end if;
  else
    update public.consents set withdrawn_at = now()
     where learner_id = p_learner and control::text = 'ai_helper' and withdrawn_at is null;
  end if;
end
$$;

/** Whether each of the parent's children has the AI helper on (Your children). */
create function public.my_children_helper()
returns table (learner_id uuid, helper_on boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return query
    select g.learner_id, public.has_helper_consent(g.learner_id)
      from public.learner_guardians g where g.user_id = public.current_adult();
end
$$;

/** A class's teachers and coaches switch "Learners may ask the AI helper" (FR-6 b). */
create function public.set_helper_allowed(p_class uuid, p_on boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teachers and coaches can change that' using errcode = '42501';
  end if;
  if public.is_family_class(p_class) then
    raise exception 'a family group follows the parent''s choice' using errcode = '22023';
  end if;
  update public.classes set helper_allowed = p_on where id = p_class;
end
$$;

/** Questions the class's learners asked in the last 7 days: a count only. */
create function public.class_helper_count(p_class uuid) returns int
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teachers and coaches can see that' using errcode = '42501';
  end if;
  return coalesce((select sum(asked)::int from public.helper_class_usage
                    where class_id = p_class and day > public.helper_today() - 7), 0);
end
$$;

-- --- Back office: AI → Helper settings ----------------------------------------------------------

create function public.helper_settings_read() returns public.helper_settings
language plpgsql stable security definer
set search_path = ''
as $$
declare r public.helper_settings;
begin
  if not public.has_role('owner') then
    raise exception 'only the owner can see the helper settings' using errcode = '42501';
  end if;
  select * into r from public.helper_settings where id = 1;
  return r;
end
$$;

/** Changes the settings given (others stay); the audit log keeps before and after. */
create function public.helper_settings_update(p_changes jsonb) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  k text;
begin
  if not public.has_role('owner') then
    raise exception 'only the owner can change the helper settings' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p_changes) loop
    if k not in ('enabled', 'children_enabled', 'adult_daily', 'child_daily',
                 'class_daily_per_learner', 'month_questions', 'month_budget_cents',
                 'refusals_to_pause', 'adult_model', 'child_model', 'faq_model',
                 'adult_prompt', 'child_prompt', 'faq_prompt') then
      raise exception 'unknown setting %', k using errcode = '22023';
    end if;
  end loop;
  select to_jsonb(s) - 'updated_at' - 'updated_by' into v_before from public.helper_settings s where id = 1;
  update public.helper_settings s set
    enabled = coalesce((p_changes ->> 'enabled')::boolean, s.enabled),
    children_enabled = coalesce((p_changes ->> 'children_enabled')::boolean, s.children_enabled),
    adult_daily = coalesce((p_changes ->> 'adult_daily')::int, s.adult_daily),
    child_daily = coalesce((p_changes ->> 'child_daily')::int, s.child_daily),
    class_daily_per_learner = coalesce((p_changes ->> 'class_daily_per_learner')::int, s.class_daily_per_learner),
    month_questions = coalesce((p_changes ->> 'month_questions')::int, s.month_questions),
    month_budget_cents = coalesce((p_changes ->> 'month_budget_cents')::int, s.month_budget_cents),
    refusals_to_pause = coalesce((p_changes ->> 'refusals_to_pause')::int, s.refusals_to_pause),
    adult_model = coalesce(p_changes ->> 'adult_model', s.adult_model),
    child_model = coalesce(p_changes ->> 'child_model', s.child_model),
    faq_model = coalesce(p_changes ->> 'faq_model', s.faq_model),
    adult_prompt = coalesce(p_changes ->> 'adult_prompt', s.adult_prompt),
    child_prompt = coalesce(p_changes ->> 'child_prompt', s.child_prompt),
    faq_prompt = coalesce(p_changes ->> 'faq_prompt', s.faq_prompt),
    updated_at = now(), updated_by = auth.uid()
   where id = 1;
  select to_jsonb(s) - 'updated_at' - 'updated_by' into v_after from public.helper_settings s where id = 1;
  perform public.write_audit('helper.settings', 'helper_settings', v_before, v_after, null);
end
$$;

/** Usage: daily totals by audience, and the month so far; no text, no ids (FR-30). */
create function public.helper_usage_totals(p_days int)
returns table (day date, audience text, asked int, refused int, blocked int, thumbs_up int, thumbs_down int)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'only the owner can see helper usage' using errcode = '42501';
  end if;
  return query
    select t.day, t.audience, t.asked, t.refused, t.blocked, t.thumbs_up, t.thumbs_down
      from public.helper_day_totals t
     where t.day > public.helper_today() - least(greatest(p_days, 1), 366)
     order by t.day desc, t.audience;
end
$$;

-- --- Grants -------------------------------------------------------------------------------------

revoke all on function public.helper_today(), public.helper_count_day(text, int, int, int, int, int),
  public.has_helper_consent(uuid), public.helper_take(uuid, uuid, boolean),
  public.helper_record(uuid, text, boolean, boolean, int), public.helper_thumb(text, boolean),
  public.helper_month_status(), public.helper_config(), public.helper_cleanup(),
  public.helper_faq_state(), public.helper_faq_store(text, text, jsonb, text, text, text),
  public.helper_faq_for(text, text), public.helper_faq_down(text, text, int, uuid)
  from public, anon, authenticated;
grant execute on function public.helper_take(uuid, uuid, boolean),
  public.helper_record(uuid, text, boolean, boolean, int), public.helper_thumb(text, boolean),
  public.helper_month_status(), public.helper_config(), public.helper_cleanup(),
  public.helper_faq_state(), public.helper_faq_store(text, text, jsonb, text, text, text),
  public.helper_faq_for(text, text), public.helper_faq_down(text, text, int, uuid)
  to service_role;
revoke all on function public.set_helper_consent(uuid, boolean, text), public.my_children_helper(),
  public.set_helper_allowed(uuid, boolean), public.class_helper_count(uuid),
  public.helper_settings_read(), public.helper_settings_update(jsonb), public.helper_usage_totals(int)
  from public, anon;
grant execute on function public.set_helper_consent(uuid, boolean, text), public.my_children_helper(),
  public.set_helper_allowed(uuid, boolean), public.class_helper_count(uuid),
  public.helper_settings_read(), public.helper_settings_update(jsonb), public.helper_usage_totals(int)
  to authenticated;
