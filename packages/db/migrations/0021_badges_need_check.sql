-- M5 step 7d (FR-15): a class's teachers and coaches switch "badges need a check" on or off.
-- When on, only records a teacher marked checked count towards badges (badge_records, 0019).
-- Revoking a wrongly awarded badge already exists (revoke_badge, 0010).

create function public.set_badges_need_check(p_class uuid, p_on boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_adult();
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teachers and coaches can change that' using errcode = '42501';
  end if;
  update public.classes set badges_need_check = p_on where id = p_class;
end
$$;

revoke all on function public.set_badges_need_check(uuid, boolean) from public, anon;
grant execute on function public.set_badges_need_check(uuid, boolean) to authenticated;
