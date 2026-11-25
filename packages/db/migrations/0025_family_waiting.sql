-- Family groups (spec FF-7): before confirming a second parent or guardian, the first parent sees
-- who opened their link: the display name that person chose, and when. Nothing else about them.

create function public.family_invitations_waiting()
returns table (id uuid, display_name text, accepted_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select i.id, coalesce(a.display_name, 'Robots For All member'), i.accepted_at
    from public.family_invitations i
    left join public.adults a on a.user_id = i.accepted_by
   where i.accepted_by is not null and i.confirmed_at is null
     and public.is_org_staff(i.organisation_id, true)
   order by i.accepted_at
$$;

revoke all on function public.family_invitations_waiting() from public, anon;
grant execute on function public.family_invitations_waiting() to authenticated;
