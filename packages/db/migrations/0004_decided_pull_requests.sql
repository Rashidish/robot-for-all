-- ADR-0012 condition 4, clarified: every status change made in the back office (send for
-- review, approve, ask for changes, build test, unpublish) is its own pull request, and the
-- decision recorded for it (by a person with the right role, checked by record_review) is what
-- lets the back office merge it. approved_pull_request now counts any recorded decision.
create or replace function public.approved_pull_request(p_pull_request text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.content_reviews where pull_request = p_pull_request
  )
$$;
