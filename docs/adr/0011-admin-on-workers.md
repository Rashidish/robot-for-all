# ADR-0011: The admin app runs on Cloudflare Workers

- **Status:** Accepted (owner, 2026-11-24). Supersedes the hosting part of [ADR-0009](0009-back-office-architecture.md) ("a second Cloudflare Pages project … Pages Functions"); the rest of ADR-0009 stands.
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
ADR-0009 put the admin app's server routes on a second Cloudflare Pages project. When building it
(back-office step 2b) we found that the current Astro adapter for Cloudflare (`@astrojs/cloudflare`
14) builds **only for Cloudflare Workers**; its Pages output is gone, and Cloudflare now steers new
projects to Workers (ADR-0002 already expected to revisit this when we add server code).

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. **Workers**: the Astro app with server routes, deployed as a Worker on `admin.robotsforall.org.za` | Server-rendered pages; little or no JS in the browser | n/a | MIT (adapter) | Free tier (100,000 requests a day) | Sign-in session in **httpOnly cookies** that page scripts can't read; supported path |
| B. Stay on Pages: pages built ahead of time, the browser talks to Supabase directly, hand-written Pages Functions for the Access check and pull requests | More JS in the browser | n/a | Ours | Free | Session tokens in browser storage, where an injected script could take them; more code of our own |

## Decision
Option A: the admin app is an Astro app with server routes, deployed as a **Cloudflare Worker**
(`robots-for-all-admin`) with the custom domain `admin.robotsforall.org.za`, behind Cloudflare
Access. The public site stays a static Cloudflare Pages project (ADR-0002).

## Why
- Admin sessions live in httpOnly, Secure, SameSite cookies set by the server, so a malicious script in a page can't steal them. For the accounts that approve lessons and manage people, this matters most.
- It is the adapter's supported path; staying on Pages means maintaining our own server glue.
- Nothing else changes: same hostname, same Cloudflare Access gate, same database rules (ADR-0010), free at our scale.

## Consequences
- Owner set-up: create the Worker's custom domain (`admin.robotsforall.org.za`) instead of a second Pages project; Cloudflare Access protects it the same way. The adapter also provisions a small **KV namespace** (`SESSION`) on first deploy (free tier).
- CI builds `apps/admin`; a separate deploy job publishes it with `wrangler deploy`, only from `main`, only once the owner has switched it on.
- The admin app keeps no secrets in the browser: the Supabase URL and anon key are used on the server only; the service key is not used by the app at all yet.
