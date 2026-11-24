-- Languages (more content spec §2.5–2.6): each back-office person lists the languages they read
-- well enough to translate or review. Translation approvals (part C) are refused from anyone
-- without that language.

alter table public.admin_profiles
  add column languages text[] not null default '{}'
  check (coalesce(array_length(languages, 1), 0) <= 12);

/** Set the languages you read (your own profile; set a reviewer name first). */
create function public.set_reviewer_languages(p_languages text[]) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_clean text[];
begin
  if not public.is_admin() then
    raise exception 'only back-office users with MFA can set their languages' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct lower(btrim(l)) order by lower(btrim(l))), '{}')
    into v_clean from unnest(coalesce(p_languages, '{}')) as l where btrim(l) <> '';
  if exists (select 1 from unnest(v_clean) as l where l !~ '^[a-z]{2,3}$') then
    raise exception 'use language codes such as zu or nso' using errcode = '22023';
  end if;
  update public.admin_profiles set languages = v_clean, updated_at = now() where user_id = auth.uid();
  if not found then
    raise exception 'choose your public reviewer name first' using errcode = '22023';
  end if;
  perform public.write_audit('profile.languages', auth.uid()::text, null,
    jsonb_build_object('languages', v_clean), null);
end
$$;

/** Does the signed-in person (with MFA) read this language? */
create function public.reads_language(p_code text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and p_code = any (languages)
  )
$$;

revoke all on function public.set_reviewer_languages(text[]), public.reads_language(text)
  from public, anon;
grant execute on function public.set_reviewer_languages(text[]), public.reads_language(text)
  to authenticated;
