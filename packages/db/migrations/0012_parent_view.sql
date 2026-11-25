-- M5 step 4c: the parent's "Your children" view (docs/specs/M5-teach.md FR-9, FR-10).
-- Parents can't read classes or organisations (those are staff-only), so this function returns,
-- for the caller's own children only, each class the child is in with its name and the school's
-- or club's name. Nothing about other learners, staff or the class's codes.

create function public.my_children_classes()
returns table (learner_id uuid, class_id uuid, class_name text, organisation_name text)
language sql stable security definer
set search_path = ''
as $$
  select cl.learner_id, c.id, c.name, o.name
    from public.learner_guardians g
    join public.class_learners cl on cl.learner_id = g.learner_id
    join public.classes c on c.id = cl.class_id
    join public.organisations o on o.id = c.organisation_id
   where g.user_id = public.current_adult()
   order by o.name, c.name
$$;

revoke all on function public.my_children_classes() from public, anon;
grant execute on function public.my_children_classes() to authenticated;
