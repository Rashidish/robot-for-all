-- Content review and publishing (docs/specs/back-office-content-review.md, ADR-0012).
-- Every decision on a lesson (sent for review, approved, changes asked, build tested,
-- unpublished) is recorded here with its checklist and notes, by a person with the right role
-- and MFA. A reviewer can't approve a lesson they sent for review (a super admin can override,
-- with a reason). The back office merges a status pull request only after an approval recorded
-- here for that pull request.

-- The name a person chooses to appear publicly in reviewed_by / build_tested_by. Never an email.
create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reviewer_name text not null
    check (length(btrim(reviewer_name)) between 2 and 40 and reviewer_name !~ '[@<>]'),
  updated_at timestamptz not null default now()
);
create unique index admin_profiles_name on public.admin_profiles (lower(btrim(reviewer_name)));

create type public.review_decision as enum (
  'sent_for_review',
  'approved',
  'changes_requested',
  'build_tested',
  'unpublished'
);

create table public.content_reviews (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  content_type text not null check (content_type in ('lesson')),
  content_id text not null check (content_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  decision public.review_decision not null,
  checklist jsonb,
  notes text,
  user_id uuid not null,
  reviewer_name text,
  pull_request text check (pull_request is null or pull_request ~ '^https://github\.com/'),
  override_reason text
);
create index content_reviews_item on public.content_reviews (content_type, content_id, at desc);

/** The ticks a reviewer must give to approve (spec §4). */
create function public.review_checklist_keys() returns text[]
language sql immutable
as $$
  select array['safety', 'electrical', 'age_language', 'caps', 'parts_cost', 'ai_read']
$$;

/** Set your own public reviewer name (any back-office user with MFA). */
create function public.set_reviewer_name(p_name text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only back-office users with MFA can set a reviewer name' using errcode = '42501';
  end if;
  insert into public.admin_profiles (user_id, reviewer_name)
  values (auth.uid(), btrim(p_name))
  on conflict (user_id) do update set reviewer_name = excluded.reviewer_name, updated_at = now();
  perform public.write_audit('profile.reviewer_name', auth.uid()::text, null,
    jsonb_build_object('reviewer_name', btrim(p_name)), null);
end
$$;

/**
 * Record a decision. Who may make it:
 *   sent_for_review: content editor;  approved / changes_requested: reviewer;
 *   build_tested: build tester;       unpublished: reviewer or owner.
 * Approve needs every checklist tick and a reviewer name, and not your own lesson (unless a
 * super admin gives an override reason). Changes, build tests and unpublishing need a note.
 */
create function public.record_review(
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
begin
  if p_decision = 'sent_for_review' and not public.has_role('content_editor') then
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
    foreach v_key in array public.review_checklist_keys() loop
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

/** For the merge check (ADR-0012): was this pull request approved in the back office? */
create function public.approved_pull_request(p_pull_request text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.content_reviews
    where pull_request = p_pull_request
      and decision in ('approved', 'build_tested', 'unpublished')
  )
$$;

-- --- Row-level security and grants ------------------------------------------------------

alter table public.admin_profiles enable row level security;
alter table public.content_reviews enable row level security;

-- Back-office users see reviewer names (they appear on lessons anyway).
create policy admin_profiles_read on public.admin_profiles for select to authenticated
  using (public.is_admin());
-- Content people see the review history.
create policy content_reviews_read on public.content_reviews for select to authenticated
  using (
    public.has_role('content_editor') or public.has_role('reviewer')
    or public.has_role('build_tester') or public.has_role('owner')
  );

revoke all on public.admin_profiles, public.content_reviews
  from public, anon, authenticated, service_role;
grant select on public.admin_profiles, public.content_reviews to authenticated, service_role;

-- Decisions are a record: nobody changes or deletes them (only reviewed migrations could).
create function public.content_reviews_are_a_record() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'review decisions can''t be changed or deleted' using errcode = '42501';
end
$$;
create trigger content_reviews_no_update_delete
  before update or delete on public.content_reviews
  for each row execute function public.content_reviews_are_a_record();

revoke all on function public.set_reviewer_name(text),
  public.record_review(text, text, public.review_decision, jsonb, text, text, text),
  public.approved_pull_request(text) from public, anon;
grant execute on function public.set_reviewer_name(text),
  public.record_review(text, text, public.review_decision, jsonb, text, text, text),
  public.approved_pull_request(text) to authenticated;
