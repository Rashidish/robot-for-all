-- Lesson translations are reviewed too (more content spec §2.7): content type "translation",
-- id "<lesson>/<language>" (e.g. p1-crank-01/zu). The same rules as a language: its own checklist,
-- only a reviewer who reads that language approves, translators send it for review, no build
-- test, and not your own.

alter table public.content_reviews drop constraint if exists content_reviews_content_type_check;
alter table public.content_reviews
  add constraint content_reviews_content_type_check
  check (content_type in ('lesson', 'template', 'world', 'season', 'language', 'translation'));

create or replace function public.review_checklist_keys_for(p_type text) returns text[]
language sql immutable
as $$
  select case p_type
    when 'world' then array['challenge_clear', 'can_finish', 'fair_points', 'fits_floor', 'child_theme']
    when 'language' then array['meaning_kept', 'safety_exact', 'child_words', 'local_terms', 'no_english_left']
    when 'translation' then array['meaning_kept', 'safety_exact', 'child_words', 'local_terms', 'no_english_left', 'ai_read']
    else public.review_checklist_keys()
  end
$$;

create or replace function public.record_review(
  p_type text,
  p_id text,
  p_decision public.review_decision,
  p_checklist jsonb,
  p_notes text,
  p_pull_request text,
  p_override_reason text default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
  v_sender uuid;
  v_key text;
  v_override text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_id bigint;
  v_lang text;
begin
  if p_type not in ('lesson', 'world', 'language', 'translation') then
    raise exception 'reviews are for lessons, worlds, languages and lesson translations (use record_withdrawal to withdraw)' using errcode = '22023';
  end if;
  -- A lesson translation's id is "<lesson>/<language>", e.g. "p1-crank-01/zu".
  if p_type = 'translation' then
    if p_id !~ '^p[1-3]-[a-z]+-[0-9]{2}/[a-z]{2,3}$' or split_part(p_id, '/', 2) = 'en' then
      raise exception 'a lesson translation is "<lesson>/<language>", e.g. p1-crank-01/zu' using errcode = '22023';
    end if;
    v_lang := split_part(p_id, '/', 2);
  elsif p_type = 'language' then
    v_lang := p_id;
  end if;
  -- A language or lesson translation is reviewed only by someone who reads that language (more
  -- content spec §2.3), and has no build test. Translators send their translations for review.
  if v_lang is not null then
    if p_decision = 'build_tested' then
      raise exception 'a translation has no build test' using errcode = '22023';
    end if;
    if p_decision in ('approved', 'changes_requested') and not public.reads_language(v_lang) then
      raise exception 'only a reviewer who reads this language (on their profile) can approve it' using errcode = '42501';
    end if;
  end if;
  if p_decision = 'sent_for_review'
    and not (public.has_role('content_editor') or (v_lang is not null and public.has_role('translator'))) then
    raise exception 'only a content editor can send for review' using errcode = '42501';
  elsif p_decision in ('approved', 'changes_requested') and not public.has_role('reviewer') then
    raise exception 'only a reviewer can approve or ask for changes' using errcode = '42501';
  elsif p_decision = 'build_tested' and not public.has_role('build_tester') then
    raise exception 'only a build tester can record a build test' using errcode = '42501';
  elsif p_decision = 'unpublished'
    and not (public.has_role('reviewer') or public.has_role('owner')) then
    raise exception 'only a reviewer or owner can unpublish' using errcode = '42501';
  end if;

  select reviewer_name into v_name from public.admin_profiles where user_id = auth.uid();
  if p_decision in ('approved', 'build_tested') and v_name is null then
    raise exception 'choose your public reviewer name first' using errcode = '22023';
  end if;
  if p_decision in ('changes_requested', 'build_tested', 'unpublished')
     and length(btrim(coalesce(p_notes, ''))) < 10 then
    raise exception 'write a note of at least 10 characters' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    foreach v_key in array public.review_checklist_keys_for(p_type) loop
      if coalesce((p_checklist ->> v_key)::boolean, false) is not true then
        raise exception 'every checklist item must be ticked (missing: %)', v_key using errcode = '22023';
      end if;
    end loop;
    -- Not your own: the person who last sent it for review can't approve it.
    select user_id into v_sender from public.content_reviews
      where content_type = p_type and content_id = p_id and decision = 'sent_for_review'
      order by at desc, id desc limit 1;
    if v_sender = auth.uid() then
      if v_override is null then
        raise exception 'you sent this for review, so someone else must approve it' using errcode = '42501';
      elsif not public.has_role('super_admin') then
        raise exception 'only a super admin can approve their own work' using errcode = '42501';
      elsif length(v_override) < 10 then
        raise exception 'an override needs a reason of at least 10 characters' using errcode = '22023';
      end if;
    else
      v_override := null;
    end if;
  else
    v_override := null;
  end if;

  insert into public.content_reviews
    (content_type, content_id, decision, checklist, notes, user_id, reviewer_name, pull_request,
     override_reason)
  values
    (p_type, p_id, p_decision, p_checklist, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(),
     v_name, p_pull_request, v_override)
  returning id into v_id;
  perform public.write_audit('content.' || p_decision::text, p_type || ':' || p_id, null,
    jsonb_build_object('pull_request', p_pull_request, 'review', v_id), v_override);
  return v_id;
end
$$;

