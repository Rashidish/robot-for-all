-- Name key rotation (ADR-0015 "Keys": rotation re-encrypts in the background; M5 acceptance
-- criterion "Rotating the name key re-encrypts every name, and certificates still print").
-- The certificate service's daily job asks for values still locked with an older key version,
-- decrypts them in memory with the old key, locks them again with the current one and saves them
-- here. The database never sees a plain name: it only hands out and takes back locked bytes.
-- A value changed in between (a parent replaced the name) is left alone: the save only applies
-- while the key version is still the old one.

/** Up to p_limit learners and waiting school enrolments with any value on another key version. */
create function public.names_to_rekey(p_current int, p_limit int)
returns table (kind text, id uuid, token_hash text,
  name bytea, name_key int, contact bytea, contact_key int, token bytea, token_key int)
language sql stable security definer
set search_path = ''
as $$
  (select 'learner', l.id, null::text, l.certificate_name, l.certificate_name_key_version,
          null::bytea, null::int, null::bytea, null::int
     from public.learners l
    where l.certificate_name_key_version <> p_current
    limit p_limit)
  union all
  (select 'pending', p.id, p.confirm_token_hash,
          p.certificate_name, p.certificate_name_key_version,
          p.parent_contact, p.parent_contact_key_version,
          p.confirm_token_sealed, p.confirm_token_key_version
     from public.pending_enrolments p
    where p.certificate_name_key_version <> p_current
       or p.parent_contact_key_version <> p_current
       or p.confirm_token_key_version <> p_current
    limit p_limit)
$$;

/**
 * Saves re-locked values: [{kind, id, name, name_key, old_name_key, contact, ..., token, ...}],
 * bytes as "\x" hex. Each value is replaced only if its key version is still the old one.
 * Returns how many values were replaced; the audit log gets the count.
 */
create function public.rekey_names(p_rows jsonb) returns int
language plpgsql security definer
set search_path = ''
as $$
declare r jsonb; v_count int := 0; v_n int;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if r->>'kind' = 'learner' then
      update public.learners
         set certificate_name = decode(substr(r->>'name', 3), 'hex'),
             certificate_name_key_version = (r->>'name_key')::int
       where id = (r->>'id')::uuid
         and certificate_name_key_version = (r->>'old_name_key')::int;
      get diagnostics v_n = row_count; v_count := v_count + v_n;
    elsif r->>'kind' = 'pending' then
      if r ? 'name' then
        update public.pending_enrolments
           set certificate_name = decode(substr(r->>'name', 3), 'hex'),
               certificate_name_key_version = (r->>'name_key')::int
         where id = (r->>'id')::uuid
           and certificate_name_key_version = (r->>'old_name_key')::int;
        get diagnostics v_n = row_count; v_count := v_count + v_n;
      end if;
      if r ? 'contact' then
        update public.pending_enrolments
           set parent_contact = decode(substr(r->>'contact', 3), 'hex'),
               parent_contact_key_version = (r->>'contact_key')::int
         where id = (r->>'id')::uuid
           and parent_contact_key_version = (r->>'old_contact_key')::int;
        get diagnostics v_n = row_count; v_count := v_count + v_n;
      end if;
      if r ? 'token' then
        update public.pending_enrolments
           set confirm_token_sealed = decode(substr(r->>'token', 3), 'hex'),
               confirm_token_key_version = (r->>'token_key')::int
         where id = (r->>'id')::uuid
           and confirm_token_key_version = (r->>'old_token_key')::int;
        get diagnostics v_n = row_count; v_count := v_count + v_n;
      end if;
    end if;
  end loop;
  if v_count > 0 then
    perform public.write_audit('privacy.names_rekeyed', null, null,
      jsonb_build_object('count', v_count), null);
  end if;
  return v_count;
end
$$;

/**
 * How many locked values each key version still holds (names, parents' emails, link secrets):
 * an old key may be removed from NAME_KEYS only once its count is 0. Counts only.
 */
create function public.name_key_counts() returns table (key_version int, values_locked int)
language sql stable security definer
set search_path = ''
as $$
  select v, count(*)::int from (
    select certificate_name_key_version as v from public.learners
     where certificate_name_key_version is not null
    union all select certificate_name_key_version from public.pending_enrolments
    union all select parent_contact_key_version from public.pending_enrolments
    union all select confirm_token_key_version from public.pending_enrolments
     where confirm_token_key_version is not null
  ) k group by v order by v
$$;

/** The same counts for back office Privacy, for the data protection officer. */
create function public.name_key_counts_for_officer()
returns table (key_version int, values_locked int)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.has_role('data_protection_officer') then
    raise exception 'only the data protection officer can see name key counts' using errcode = '42501';
  end if;
  return query select * from public.name_key_counts();
end
$$;

revoke all on function public.names_to_rekey(int, int), public.rekey_names(jsonb),
  public.name_key_counts() from public, anon, authenticated;
grant execute on function public.names_to_rekey(int, int), public.rekey_names(jsonb),
  public.name_key_counts() to service_role;
revoke all on function public.name_key_counts_for_officer() from public, anon;
grant execute on function public.name_key_counts_for_officer() to authenticated;
