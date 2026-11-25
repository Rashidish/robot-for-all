-- M5 step 5c (ADR-0013): the teacher's view of each learner's sign-in (has a PIN, locked), and
-- QR sign-in cards for events. A card carries a random secret (never the PIN); only its SHA-256
-- is stored. Making a class's cards again replaces the old ones; cards can be withdrawn.

/** For a class's staff: each learner's sign-in state, never the PIN or its hash. */
create function public.class_learner_status(p_class uuid)
returns table (learner_id uuid, nickname text, avatar text, has_pin boolean, locked boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teachers and coaches can see that' using errcode = '42501';
  end if;
  return query
    select l.id, l.nickname, l.avatar, l.pin_hash is not null,
           coalesce(l.locked_until > now(), false)
      from public.class_learners cl
      join public.learners l on l.id = cl.learner_id
     where cl.class_id = p_class
       and public.has_consent(l.id, 'record') and public.has_consent(l.id, 'class', p_class)
     order by lower(l.nickname);
end
$$;

create table public.sign_in_cards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.sign_in_cards enable row level security;
revoke all on public.sign_in_cards from anon, authenticated;

/**
 * Makes one card per learner on the class's sign-in list, replacing any earlier cards. Returns
 * each card's secret once (for the printed QR code); only its hash is kept.
 */
create function public.create_sign_in_cards(p_class uuid)
returns table (learner_id uuid, nickname text, avatar text, secret text)
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := public.require_adult(); v_row record; v_secret text;
begin
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teachers and coaches can make sign-in cards' using errcode = '42501';
  end if;
  update public.sign_in_cards set revoked_at = now()
   where class_id = p_class and revoked_at is null;
  for v_row in
    select r.learner_id, r.nickname, r.avatar
      from public.sign_in_roster((select class_code from public.classes where id = p_class)) r
  loop
    v_secret := public.random_token() || public.random_token();
    insert into public.sign_in_cards (class_id, learner_id, secret_hash, created_by)
    values (p_class, v_row.learner_id, encode(sha256(convert_to(v_secret, 'UTF8')), 'hex'), v_user);
    learner_id := v_row.learner_id;
    nickname := v_row.nickname;
    avatar := v_row.avatar;
    secret := v_secret;
    return next;
  end loop;
end
$$;

/** Withdraws all of a class's cards (lost cards, or the event is over). Returns how many. */
create function public.revoke_sign_in_cards(p_class uuid) returns int
language plpgsql security definer
set search_path = ''
as $$
declare v_count int;
begin
  perform public.require_adult();
  if not public.is_class_staff(p_class) then
    raise exception 'only the class''s teachers and coaches can withdraw sign-in cards' using errcode = '42501';
  end if;
  update public.sign_in_cards set revoked_at = now() where class_id = p_class and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

/**
 * For the sign-in service: the learner a card signs in, if the card is live and the learner is
 * still on that class's sign-in list (consents, parent not locked).
 */
create function public.card_for_sign_in(p_hash text)
returns table (learner_id uuid, nickname text, avatar text, session_version int)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.nickname, l.avatar, l.session_version
    from public.sign_in_cards c
    join public.classes k on k.id = c.class_id
    join public.sign_in_roster(k.class_code) r on r.learner_id = c.learner_id
    join public.learners l on l.id = c.learner_id
   where c.secret_hash = p_hash and c.revoked_at is null
$$;

revoke all on function public.class_learner_status(uuid), public.create_sign_in_cards(uuid),
  public.revoke_sign_in_cards(uuid) from public, anon;
grant execute on function public.class_learner_status(uuid), public.create_sign_in_cards(uuid),
  public.revoke_sign_in_cards(uuid) to authenticated;
revoke all on function public.card_for_sign_in(text) from public, anon, authenticated;
grant execute on function public.card_for_sign_in(text) to service_role;
