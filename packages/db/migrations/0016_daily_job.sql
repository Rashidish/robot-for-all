-- M5 step 4e (part 2): what the certificate service's daily job needs (spec v0.5 §7.5, FR-5a).
--   * reminders for waiting school enrolments (two, on days 5 and 10 of the 14): the link's
--     secret is kept locked (encrypted by the service) so the reminder can carry the same link;
--     it goes with the request when it is confirmed, withdrawn or expires;
--   * dormancy warnings at 10 and 11 months, by email, to the adult's own sign-in address;
--   * when the back office was last emailed, so its notice goes every 7 days, not daily.

alter table public.pending_enrolments
  add column confirm_token_sealed bytea,
  add column confirm_token_key_version int,
  add check ((confirm_token_sealed is null) = (confirm_token_key_version is null));

/** The service keeps the link's secret, locked, for the reminders. */
create function public.store_pending_token(p_id uuid, p_sealed bytea, p_key int) returns void
language sql security definer
set search_path = ''
as $$
  update public.pending_enrolments
     set confirm_token_sealed = p_sealed, confirm_token_key_version = p_key
   where id = p_id
$$;

/** Waiting enrolments due a reminder today: the first after 5 days, the second after 10. */
create function public.pending_reminders_due()
returns table (id uuid, class_id uuid, confirm_token_hash text, confirm_token_sealed bytea,
  confirm_token_key_version int, parent_contact bytea, parent_contact_key_version int)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.class_id, p.confirm_token_hash, p.confirm_token_sealed,
         p.confirm_token_key_version, p.parent_contact, p.parent_contact_key_version
    from public.pending_enrolments p
   where p.reminders_sent < 2
     and p.confirm_token_sealed is not null
     and p.expires_at > now()
     and p.requested_at <= now() - (p.reminders_sent + 1) * interval '5 days'
$$;

create function public.pending_reminder_sent(p_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  update public.pending_enrolments set reminders_sent = reminders_sent + 1 where id = p_id
$$;

/** Dormancy warnings due today, with the adult's own sign-in email (they are the account holder). */
create function public.dormancy_warnings_due()
returns table (user_id uuid, months int, email text)
language sql stable security definer
set search_path = ''
as $$
  select d.user_id, d.months, u.email::text
    from public.dormancy_notices_due() d
    join public.adults a on a.user_id = d.user_id
    join auth.users u on u.id = d.user_id
   where a.deletion_due_at is null and u.email is not null
$$;

create table public.job_runs (
  name text primary key check (name ~ '^[a-z_]+$'),
  last_at timestamptz not null
);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;

/** True (and recorded) when this job last ran at least p_every ago, or never. */
create function public.job_due(p_name text, p_every interval) returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.job_runs where name = p_name and last_at > now() - p_every) then
    return false;
  end if;
  insert into public.job_runs (name, last_at) values (p_name, now())
  on conflict (name) do update set last_at = now();
  return true;
end
$$;

revoke all on function public.store_pending_token(uuid, bytea, int),
  public.pending_reminders_due(), public.pending_reminder_sent(uuid),
  public.dormancy_warnings_due(), public.job_due(text, interval)
  from public, anon, authenticated;
grant execute on function public.store_pending_token(uuid, bytea, int),
  public.pending_reminders_due(), public.pending_reminder_sent(uuid),
  public.dormancy_warnings_due(), public.job_due(text, interval)
  to service_role;
