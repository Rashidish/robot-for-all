# ADR-0009: Back-office architecture

- **Status:** Proposed (back-office spec v0.4 approved by the owner, 2026-11-24; this ADR waits for review)
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
The back office runs all administration and configuration of the front office: lesson approval,
people and access, competitions, seasons and every other module in `docs/specs/back-office.md` §4.
`apps/admin` is empty. The public site is static on Cloudflare Pages (ADR-0002), and content is
Markdown and JSON in Git, reviewed through pull requests (ADR-0004).

Non-negotiables that apply: the public site stays low-data, offline-capable and zero-rating-friendly
(CLAUDE.md §2); admin tools are never exposed in the front office (§10); secrets live only in
environment variables (§7); nothing AI-generated is published without review (§8).

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. Git-based CMS only (Decap) | ~1.5 MB admin app | n/a | MIT | Free | Edits files only; can't manage people, roles or competitions (spec v0.1, dropped in v0.2) |
| B. **Own admin app** (Astro + Svelte, server routes on Cloudflare Pages Functions) on its own hostname; content written through a GitHub App as pull requests; operational data in Postgres | Small; only admins download it | n/a (online only) | Ours | Free tiers | Same stack and components as the front office; one place for every module |
| C. Admin pages inside the public site | Adds code to the public build | — | Ours | Free | Breaks CLAUDE.md §10; risk of admin code reaching learners |
| D. A hosted admin builder (e.g. Retool) | — | — | Proprietary | Paid per seat | Third-party domain holding our data; lock-in |

## Decision
Option B: `apps/admin` is an Astro + Svelte app with server routes on a **second Cloudflare Pages
project** at **`admin.robotsforall.org.za`**, behind **Cloudflare Access**. Content changes go to
Git as pull requests through a **GitHub App**; operational data lives in Postgres (ADR-0010).

## How it works
- **Hosting:** a separate Pages project (`robot-for-all-admin`) built from `apps/admin` by CI and deployed only from `main`. Astro's Cloudflare adapter runs the server routes (Pages Functions). The public project and its build are unchanged.
- **Gate:** **Cloudflare Access** (Zero Trust free plan, up to 50 people) covers the whole admin hostname. Only listed email addresses reach any page, after a one-time code. The app also checks the `Cf-Access-Jwt-Assertion` header on every server route, so a mistake in the Access setup doesn't open the app.
- **Content writes:** a GitHub App installed on this repository only, with contents and pull requests write permission. A server route creates a branch and opens a pull request (for example, a season's new dates). **Branch protection on `main`** (required review and green CI, no bypass for the App) means the App can never change the live site by itself. The App's private key is a Cloudflare secret.
- **Content reads:** the admin app reads `content/` from the repository at the current `main` (GitHub API, cached), and reuses the same checks as the public build (`packages/sim` world and season checks, the lesson schema), so an admin sees problems before CI does.
- **Operational data:** through the database with row-level security (ADR-0010); service keys only in server routes.
- **Security headers:** strict CSP, `X-Robots-Tag: noindex`, no third-party scripts or fonts; the admin app is never linked from the public site.

## Why
- One app covers every module in the spec's map, from season dates to competitions and people.
- Pull requests keep the review gate and history that ADR-0004 chose, and the public site stays static: learners see no change in size, requests or offline behaviour.
- Same framework and shared `packages/ui` components as the front office: no second stack to learn.
- Cloudflare Access plus app sign-in gives two independent locks for free.

## Consequences
- The repo gains its first server code (Pages Functions in `apps/admin` only) and a second deploy job.
- CI builds and tests `apps/admin` (unit tests per role, an e2e sign-in test against a local database). Dependency and secret scanning cover it.
- Owner actions: the admin Pages project and hostname, Cloudflare Access with the admin emails, the GitHub App, branch protection on `main` (spec §13).
- A pull request per content change can feel slow for tiny edits; the super admin can approve their own with a reason (ADR-0010), and publishing still waits for CI (about 5 minutes).
- Revisit if Pages Functions' free limits are reached (unlikely: admins are few).
