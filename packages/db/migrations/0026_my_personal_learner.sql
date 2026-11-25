-- Personal learners (family and personal spec, step 3): an adult's own learner profile, so the
-- account page shows it as "Learning myself", not as one of their children.

create function public.my_personal_learner() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.learners where self_user_id = public.current_adult()
$$;

revoke all on function public.my_personal_learner() from public, anon;
grant execute on function public.my_personal_learner() to authenticated;
