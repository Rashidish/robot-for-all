-- Back office: the people screen (docs/specs/back-office.md §4.1 "People → Back-office roles").
-- Owners and super admins see who has a back-office role, with their email, and give a role to
-- someone by email. Emails live in auth.users, which pages can't read directly, so these two
-- functions check the caller's role (with MFA) first.

/** Everyone with a back-office role: id, email, roles. Owners and super admins only. */
create function public.admin_people()
returns table (user_id uuid, email text, roles text[])
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'only an owner or super admin can see the people list' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, array_agg(a.role::text order by a.role)
    from public.admin_roles a
    join auth.users u on u.id = a.user_id
    group by u.id, u.email
    order by u.email;
end
$$;

/** Give a role to the account with this email (the person must have signed up first). */
create function public.grant_role_by_email(p_email text, p_role public.admin_role) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.has_role('owner') then
    raise exception 'only an owner or super admin can give roles' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'no account with that email: ask them to sign up first' using errcode = 'P0002';
  end if;
  perform public.grant_role(v_user, p_role);
  return v_user;
end
$$;

revoke all on function public.admin_people(), public.grant_role_by_email(text, public.admin_role)
  from public, anon;
grant execute on function public.admin_people(), public.grant_role_by_email(text, public.admin_role)
  to authenticated;
