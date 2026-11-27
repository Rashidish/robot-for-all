-- M6 step 7: back office AI → Helper settings shows the month so far (questions and estimated
-- spend against the caps). Counts only; the owner, as for the other helper settings (0028).

create function public.helper_month_for_owner()
returns table (questions int, spend_cents int, month_questions int, month_budget_cents int)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'only the owner can see helper usage' using errcode = '42501';
  end if;
  return query select * from public.helper_month_status();
end
$$;

revoke all on function public.helper_month_for_owner() from public, anon;
grant execute on function public.helper_month_for_owner() to authenticated;
