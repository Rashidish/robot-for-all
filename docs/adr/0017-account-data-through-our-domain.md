# ADR-0017: Account data through our own domain

- **Status:** Accepted (owner go-ahead for M5 step 3, 2026-11-25)
- **Date:** 2026-11-25
- **Decider:** Rashid Ishmail

## Context
M5's account pages (sign-in, classes, enrolment, progress) talk to Supabase. Three non-negotiables
apply: the site's Content-Security-Policy allows connections only to our own site
(`connect-src 'self'`); zero-rated data covers only `robotsforall.org.za`, so calls to
`*.supabase.co` would cost learners' families data; and nothing secret or unnecessary should be
shipped in pages.

## Options considered
| Option | Zero-rated | CSP | Size | Notes |
|---|---|---|---|---|
| A. **Same-origin proxy**: a Cloudflare Pages Function at `/db/*` forwards allowed calls to Supabase | Yes (our hostname) | Unchanged (`'self'`) | ~2 KB client, no library | We choose which calls are reachable at all |
| B. Browser calls `*.supabase.co` with supabase-js | No | Must allow Supabase's host | ~50 KB gzip | Simplest code; data not zero-rated |
| C. Supabase custom domain (`db.robotsforall.org.za`) | Only if zero-rating covers the subdomain | Must allow it | ~50 KB | Paid add-on; still a second host |

## Decision
**A:** account pages call `/db/…` on our own hostname; `functions/db/[[path]].ts` forwards only an allow-list to Supabase and adds the public (anon) key itself.

## How
- **Allow-list** (`apps/web/src/account/proxy.ts`, unit-tested): sign-in calls (`auth/v1/otp`, `verify`, `token`, `logout`, `user`); the database functions an adult or learner may call (migration 0010); reads of the M5 tables; writes only to a learner's own `sheet_records`. Service-role functions (`set_certificate_name`, `delete_dormant_accounts`, …), back-office tables and storage are not reachable at all.
- Only a fixed set of request headers is forwarded (never cookies). Responses are `Cache-Control: no-store`, and the service worker never answers or stores `/db/` requests.
- **Client:** a small `fetch` wrapper (`apps/web/src/account/client.ts`) instead of supabase-js: one-time codes, session refresh, database calls. The session is kept in `localStorage` on that device; the strict CSP (scripts only from our own site) is the protection against script injection.
- **Secrets:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Cloudflare Pages project settings. Without them `/db/` answers 503 and the site works as before.
- The function sits at the repository root (`functions/`), where `wrangler pages deploy` (run from the root) picks it up.

## Consequences
- Easier: account traffic is zero-rated and same-origin; the account pages carry no third-party code; we can see and limit exactly what is reachable.
- Harder: Pages Function requests count towards Cloudflare's free daily limit (100,000); adding a database call means adding it to the allow-list (deliberately).
- Watch: keep the allow-list in step with migrations; rate limiting for sign-in codes is Supabase Auth's (and the sign-in Worker's for learners, ADR-0013).
