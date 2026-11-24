# ADR-0010: Accounts, roles and the audit log

- **Status:** Accepted (owner, 2026-11-24)
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
The back office needs sign-in, roles (super admin, owner, reviewer, competition manager and the rest
in `docs/specs/back-office.md` §3), overrides with reasons, and an audit log. M5 will add accounts
for teachers, coaches, parents and learners. CLAUDE.md §5 already plans Postgres (for example
Supabase) with row-level security, and §7 asks for least-privilege roles, secrets in environment
variables only and threat models for anything touching accounts.

The owner decided (2026-11-24): operational data goes into the database now (brought forward from
M5, for back-office accounts first); a super admin covers the first owner and reviewer and can
override checks; Cloudflare Access sits in front of the back office (ADR-0009).

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. **Supabase** (Postgres + Auth) | Small client; server routes only in the admin | n/a | Apache-2.0 (self-hostable) | Free tier | Row-level security in the database; TOTP MFA on the free plan; same accounts system for M5 |
| B. Cloudflare Access only, no app accounts | — | — | — | Free | Fine as a gate, but no roles in the data, nothing for M5 |
| C. Auth.js + Cloudflare D1 (SQLite) | Small | — | ISC / proprietary DB | Free | Roles and MFA to build ourselves; no row-level security |
| D. Hosted auth (Clerk, Auth0) | Third-party scripts and domains | — | Proprietary | Free tiers, then per user | Third-party domain for M5 learners breaks zero-rating; lock-in |

## Decision
Option A: **Supabase** for back-office accounts now and M5 accounts later. **MFA (authenticator
app) is required** for every back-office account. Roles live in the database and are enforced by
**row-level security**; every action goes into an append-only **audit log**.

## Data model (first migration)
- `admin_roles (user_id, role, granted_by, granted_at)`; roles: `super_admin`, `owner`, `content_editor`, `reviewer`, `build_tester`, `translator`, `competition_manager`, `judge`, `moderator`, `coach_verifier`, `shop_manager`, `communications`, `support`, `data_protection_officer`.
- Row-level security on every back-office table requires a signed-in user **with MFA** (`aal2` in the token) and the right role.
- Owners may grant roles below owner; only a super admin may grant `owner` or `super_admin`. A database rule keeps **at least one super admin**.
- `audit_log (id, at, user_id, action, target, before, after, override_reason)`: insert-only: `UPDATE` and `DELETE` are revoked from every database role, the service role included, so only a reviewed migration could ever change it; owners and super admins can read it.
- **Overrides** (approve own work, publish without a second reviewer, reopen a closed competition, unlock an account) go through one server function that requires a super admin, a written reason, and writes the audit entry with `override_reason`. The admin home lists recent overrides to every owner.
- **Break-glass:** a second super admin account whose password and MFA recovery codes are kept in a password-manager vault (owner decision, 2026-11-24). Its sign-in sends an alert to every owner.

## Why
- Permissions are checked in the database itself, so a missed check in a page can't leak or change data.
- MFA on the free plan; the same accounts serve the M5 portal, so people are managed in one place.
- Open source and self-hostable, so we're not locked in; standard Postgres underneath.

## Consequences
- The database arrives before M5, holding only back-office accounts, roles and the audit log at first. POPIA basis for admins' data: agreement with staff and volunteers; listed in the privacy notice.
- **Free-plan projects pause after a week without activity** and have no backups: before launch, either keep the project active (the admin app's own use usually does) or move to the paid plan (about USD 25 a month); the owner decides at launch.
- Region: Supabase has no South African region today; choose the nearest available region at setup and note it in the privacy notice (cross-border transfer under POPIA §72).
- Service keys live only in the admin app's Cloudflare secrets, never in the browser. Learner data (M5) gets its own spec and threat model.
- Tests: database tests for every role's allowed and refused actions, the at-least-one-super-admin rule, insert-only audit log, and the override function.
