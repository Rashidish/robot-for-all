-- More content (docs/specs/back-office-more-content.md): withdraw / restore any live item, more
-- content types, and the seventh review tick (templates printed and measured).

alter type public.review_decision add value if not exists 'withdrawn';
alter type public.review_decision add value if not exists 'restored';

alter table public.content_reviews drop constraint if exists content_reviews_content_type_check;
alter table public.content_reviews
  add constraint content_reviews_content_type_check
  check (content_type in ('lesson', 'template', 'world', 'season', 'language'));
alter table public.content_reviews drop constraint if exists content_reviews_content_id_check;
alter table public.content_reviews
  add constraint content_reviews_content_id_check
  check (content_id ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)?$');

create or replace function public.review_checklist_keys() returns text[]
language sql immutable
as $$
  select array['safety', 'electrical', 'age_language', 'caps', 'parts_cost', 'ai_read', 'templates']
$$;

/**
 * Withdraw or restore a live item (spec §2.4). Owners and reviewers: anything; competition
 * managers also worlds and seasons. A reason (note) of at least 10 characters is required.
 */
create function public.record_withdrawal(
  p_type text,
  p_id text,
  p_decision public.review_decision,
  p_reason text,
  p_pull_request text
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_decision not in ('withdrawn', 'restored') then
    raise exception 'use record_review for other decisions' using errcode = '22023';
  end if;
  if not (
    public.has_role('owner') or public.has_role('reviewer')
    or (p_type in ('world', 'season') and public.has_role('competition_manager'))
  ) then
    raise exception 'only an owner or reviewer can withdraw or restore this' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'write a reason of at least 10 characters' using errcode = '22023';
  end if;
  insert into public.content_reviews
    (content_type, content_id, decision, notes, user_id, reviewer_name, pull_request)
  values
    (p_type, p_id, p_decision, btrim(p_reason), auth.uid(),
     (select reviewer_name from public.admin_profiles where user_id = auth.uid()), p_pull_request)
  returning id into v_id;
  perform public.write_audit('content.' || p_decision::text, p_type || ':' || p_id, null,
    jsonb_build_object('pull_request', p_pull_request, 'reason', btrim(p_reason)), null);
  return v_id;
end
$$;

revoke all on function public.record_withdrawal(text, text, public.review_decision, text, text)
  from public, anon;
grant execute on function public.record_withdrawal(text, text, public.review_decision, text, text)
  to authenticated;

-- Competition managers also see the history of worlds and seasons they may withdraw.
drop policy if exists content_reviews_read on public.content_reviews;
create policy content_reviews_read on public.content_reviews for select to authenticated
  using (
    public.has_role('content_editor') or public.has_role('reviewer')
    or public.has_role('build_tester') or public.has_role('owner')
    or (content_type in ('world', 'season') and public.has_role('competition_manager'))
  );
