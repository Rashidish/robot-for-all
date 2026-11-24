# @robots-for-all/db

Database migrations for Supabase (ADR-0010, `docs/specs/back-office.md`). Plain SQL, applied in
file-name order. Every permission is enforced here, in the database, with row-level security.

| Migration | What it sets up |
|---|---|
| `0001_back_office_roles_and_audit.sql` | Back-office roles (super admin, owner, reviewer, …), `grant_role` / `revoke_role`, at-least-one-super-admin rule, insert-only `audit_log`, `log_action`, super-admin `record_override` (needs a written reason), `bootstrap_super_admin` |

## Tests

`npm test` runs `src/*.test.ts` on **PGlite** (real Postgres compiled to WebAssembly, Apache-2.0,
dev dependency only) with `test-support/supabase-stub.sql`, a stand-in for the few Supabase
pieces the migrations use (`auth.users`, `auth.uid()`, `auth.jwt()`, the `anon`,
`authenticated` and `service_role` roles). No server or Docker is needed, locally or in CI.

## Applying to Supabase (owner, once the project exists)

1. In the Supabase dashboard: **Authentication → Multi-factor** on (TOTP).
2. Apply the migrations in order (Supabase CLI `supabase db push`, or paste each file into the SQL editor).
3. Create your own account (sign up once in the admin app, or **Authentication → Users → Add user**), set up your authenticator app, then make yourself the first super admin with the service key (SQL editor runs as the owner, which is allowed):
   ```sql
   select public.bootstrap_super_admin((select id from auth.users where email = 'you@example.org'));
   ```
   This works only once: when a super admin exists it refuses.
4. Create the **break-glass** account the same way, put its password and MFA recovery codes in the password-manager vault, and grant it `super_admin` from your own account in the admin app.

Never put the service key in a page or in the repository: it lives only in the admin app's
Cloudflare secrets (ADR-0009).
