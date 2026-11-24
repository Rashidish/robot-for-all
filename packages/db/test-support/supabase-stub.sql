-- Tests only: the small part of Supabase that our migrations use, so they run on plain Postgres
-- (PGlite in the unit tests). On Supabase these already exist and this file is never applied.
-- auth.uid() and auth.jwt() read the signed-in user's claims the same way Supabase does.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text not null unique
);

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
