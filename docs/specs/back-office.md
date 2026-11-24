# Spec: Back office — foundation and module map

> **Version:** 0.2 (draft) · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Draft, waiting for owner review
> Replaces v0.1 "Back office — Season dates" (one screen only).

## 1. Purpose

The back office is where the platform is **run**: every approval, setting and person behind the
public site is managed there. The owner (2026-11-24): *"the back office is critical to all
administration and configuration of the front office, like lessons approval, user and access
management, setting up of competitions"*, and season dates must be configurable there.

There is no back office yet (`apps/admin` is empty). Today, content is approved by merging pull
requests, and settings such as season dates live in files in the repository. This spec sets the
**foundation** every back-office module stands on (hosting, sign-in, roles, audit, where data
lives) and the **module map** with the order to build them. Each module gets its own short spec
before it is built.

## 2. Scope

**In scope (this spec)**
- The back office's hosting, sign-in, roles and permissions, and audit log.
- Where each kind of back-office data lives (content in Git, operational data in the database).
- The module map, and which modules come with which milestone.
- The first module in detail: **Configuration → Seasons** (season dates), §6.5.

**Out of scope (each gets its own spec)**
- The detailed screens of the other modules (§4).
- The public teacher/coach/parent portal (M5 front office).

## 3. Users and roles

Least privilege: each person gets only the roles they need. One person can hold several roles.

| Role | Can |
|---|---|
| **Owner** | Everything, including giving and taking away roles; at least two owners so nobody gets locked out |
| **Content editor** | Draft and edit lessons, worlds, courses, seasons and translations; send them for review |
| **Reviewer** | Approve content for publishing (sets `reviewed_by`); can't approve their own drafts |
| **Competition manager** | Create competitions and seasons' settings, open and close them, publish results |
| **Judge** | Score challenge entries (completion, function, presentation), check top places after replay |
| **Moderator** | Approve or reject user-generated content (projects, entries, comments) |
| **Coach verifier** | Check and approve volunteer coaches (identity, police clearance where required) |
| **Support** | Look up a school, class or teacher account to help; no access to learner details beyond nicknames |

Every role is checked **on the server** (database row-level security and the back-office API), never only in the page.

**Journeys (examples)**
1. *Approve a lesson:* a content editor sends `p2-art-01` for review → a reviewer opens it in **Content → Review queue**, reads the lesson, answer sheet and template previews, ticks the checklist (safety, CAPS links, build tested) and approves → the lesson's status becomes `published`, `reviewed_by` is set, and it goes live on the next deploy.
2. *Set season dates:* a competition manager opens **Configuration → Seasons → Season 1**, changes the start date and saves → after review it goes live (§6.5).
3. *Set up a competition:* a competition manager creates "Surprise maze day, 14 March 2027": course `bump-maze`, a secret maze number revealed at 09:00, entries 09:00–12:00, Grade 4–6 → schools sign up in the portal → results are replayed on the server, a judge checks the top places, and the manager publishes the results.
4. *Give someone access:* an owner invites a new reviewer by email → they sign in with MFA → the owner sets their roles → the change is in the audit log.

## 4. Module map

| Module | What it does | Needs | When |
|---|---|---|---|
| **Foundation** | Hosting, sign-in with MFA, roles, audit log, admin home | Database (auth) | **First** (now) |
| **Configuration** | Seasons (dates, courses), site settings, feature switches | Foundation | **First** (now) |
| **Content review & publishing** | Review queue for lessons, templates, worlds, courses, seasons, translations; approve → publish | Foundation + GitHub App | Next (before launch) |
| **Users & access** | Admin roles now; with M5: schools, teachers, coaches, parents, classes; consent records; account deletion | Foundation; M5 accounts | Admin roles now, rest with M5 |
| **Competitions** | Create competitions (season skills run, surprise maze day, floor showcase), entry windows, grade bands, leaderboards, results | M5 accounts + server replay (M4 §13.5) | After M5 |
| **Scoring & judging** | Score challenge entries; check replayed top places | Competitions | After M5 |
| **Moderation** | Approve user-generated content before it is public | M5 uploads | With the first uploads |
| **Coach verification** | Verify volunteer coaches before they host live sessions | Users & access | Before live sessions |
| **AI generation** | Draft lessons, templates, translations; always into the review queue | Content review; Claude API on our server | Later (CLAUDE.md §8) |
| **Kit catalogue** | Kits, prices, suppliers | Foundation | With the kit store |
| **Newsletter** | Events, results, rankings | Competitions | Later |

## 5. Non-functional requirements

- **Separate from the public site:** its own hostname, never linked from or bundled into the public site (CLAUDE.md §10). Learners' pages, sizes and requests don't change.
- **Accessible:** WCAG 2.2 AA; works on a phone at 360 px (an owner or judge may use a phone).
- **Cost:** free tiers only at our scale.
- **Languages:** English for admins. Anything learners see is still edited as translation keys.
- **Online only:** the back office doesn't need to work offline.

## 6. Technical architecture

### 6.1 Two kinds of data, two homes

| | **Content** (lessons, templates, worlds, courses, seasons, translations) | **Operational data** (people, roles, schools, classes, competitions, entries, scores, moderation, settings that change often) |
|---|---|---|
| Lives in | Git (`content/`), as today (ADR-0004) | Postgres (Supabase, as CLAUDE.md §5 already plans for M5) |
| Changed by | The back office opens a **pull request** through a GitHub App; CI checks it; publishing = merge | The back office API, with row-level security per role |
| Why | Review, history and offline static build come free; the public site stays static and zero-rating-friendly | Changes many times a day; per-person data; must not be in a public repository |

Season dates stay **content**: they change a few times a year and the public site needs them offline. Competitions are **operational**: entries, windows and results change live. The public site reads competition data only in the portal (M5), with an offline cache.

### 6.2 The admin app

- `apps/admin`: **Astro + Svelte** (same stack and shared `packages/ui` components as the front office, ADR-0001), server-rendered on **Cloudflare Pages Functions** (the public site stays static).
- Hostname **`admin.robotsforall.org.za`**, `noindex`, strict CSP, no third-party scripts.
- Reads content from the repository; writes content through a **GitHub App** installed on this repository only (contents and pull requests: write, nothing else). It pushes a new branch and opens a pull request; **branch protection on `main`** (required review and green CI, no bypass for the App) means it can never change the live site by itself. The App's private key is a Cloudflare secret.

### 6.3 Sign-in and roles

- **Supabase Auth** with email sign-in and **required MFA** (authenticator app) for every back-office account. The same accounts system serves the M5 portal, so there is one place to manage people.
- An `admin_roles` table (`user_id`, `role`, `granted_by`, `granted_at`) with row-level security; only owners can change it.
- Optional second layer: **Cloudflare Access** in front of the admin hostname (free up to 50 people), so unlisted people never reach the sign-in page.

### 6.4 Audit log

Every back-office action (sign-in, role change, approval, setting change, publish, competition change) is written to an append-only `audit_log` table: who, what, when, before/after. Owners can read it; nobody can edit or delete it. Content changes are also in Git history.

### 6.5 First module: Configuration → Seasons

- Lists every season (number, name, dates, courses, state today: upcoming / current / past).
- A competition manager or owner changes the **start and end dates** (date pickers; the end can't be before the start).
- Saving opens a pull request that changes only `content/seasons/<id>.json`; CI checks it (`packages/sim/src/season.ts`); a reviewer or owner merges; the site redeploys in about 2 minutes and phones get the new dates the next time they are online.
- Later in the same module: create a new season, choose its three courses, upload its badge.

### 6.6 ADRs needed

- **ADR-0009 Back-office architecture**: the admin app on its own hostname, Pages Functions, GitHub App for content writes.
- **ADR-0010 Accounts and roles**: Supabase Auth with MFA, roles table, row-level security, audit log (shared with M5).

## 7. Security, privacy and child safety

- **Personal data:** admins' names, emails and MFA settings (POPIA basis: contract or agreement with staff and volunteers). Learner data appears only in later modules, each with its own POPIA notes; Support sees nicknames only.
- **Threat notes:**
  - *Stolen admin password* → MFA required; Cloudflare Access as an extra gate; sessions expire; sign-ins in the audit log.
  - *Insider misuse* → least-privilege roles; reviewers can't approve their own work; every action audited; at least two owners.
  - *A role check missed in the page* → every permission enforced in the database (row-level security) and API, not the UI; tests for each role.
  - *Leaked GitHub App key* → the App is installed on this one repository; branch protection stops it writing to `main`, so merges still need a person and a green CI; rotate the key on suspicion.
  - *Leaked database service key* → never in the browser; only in Cloudflare secrets; least-privilege database roles.
  - *Bad content published* → the same CI checks as today plus human review; `published` needs `reviewed_by`.
  - *Admin app exposed* → separate hostname, `noindex`, not linked from the public site.
- **Secrets** live only in Cloudflare and GitHub secret stores (CLAUDE.md §7). Dependency and secret scanning cover `apps/admin`.

## 8. Acceptance criteria (foundation + seasons)

- [ ] Only a person with a back-office role can sign in, and only with MFA; others are refused.
- [ ] Each role sees only its modules, and the server refuses actions outside the role (tests per role).
- [ ] An owner can give and take away roles; each change is in the audit log.
- [ ] Changing Season 1's dates opens a pull request changing only `content/seasons/rhino-patrol.json`; an end before the start can't be saved, and CI fails if one gets into a file.
- [ ] After the merge, the Robot tab shows the right season state for the new dates.
- [ ] The public site's pages, sizes, CSP and requests are unchanged.

## 9. Work plan for Claude Code

1. **ADR-0009 + ADR-0010**, and this spec's open questions (§13) answered. ⏸ owner review.
2. **Foundation**: `apps/admin` skeleton (sign-in page, admin home, role checks, audit log), database migrations for roles and audit log, CI job and tests. ⏸ owner actions (§13), then the owner signs in.
3. **Configuration → Seasons** (§6.5) with the GitHub App. ⏸ owner changes a date end to end.
4. **Content review & publishing**: short spec first, then build. ⏸
5. Further modules in the order of §4, each with a short spec, following the milestones.

## 10. AI opportunities · 11. Revenue notes · 12. Risks · 13. Owner decisions and actions

- **AI:** AI-drafted content always lands in the review queue (CLAUDE.md §8); the M6 helper's cost caps can be a setting in Configuration.
- **Revenue:** school dashboards, competition packs and sponsored seasons are managed here.
- **Risks:** this brings the database forward from M5 (only for admin accounts at first); a server-rendered admin app is new for this repo; GitHub App setup is a one-off owner task.
- **Owner decisions:**
  1. Approve the split: content in Git through pull requests, operational data in Supabase.
  2. Approve the role list in §3 (add or remove roles).
  3. Cloudflare Access as an extra gate: yes or no.
  4. Who the first owners and reviewers are (at least two owners).
- **Owner actions (before step 2):** create the Supabase project (free tier, the region nearest South Africa); add `admin.robotsforall.org.za` to a new Cloudflare Pages project; install a GitHub App on this repository only (contents: write, pull requests: write) and protect `main` (required review and green CI, no bypass); put the keys into Cloudflare secrets; require 2FA for everyone with write access to the repository.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft: season dates only, with Decap CMS |
| 0.2 | 2026-11-24 | Owner: the back office runs all administration and configuration (lesson approval, users and access, competitions). Rewritten as the foundation and module map; seasons become its first module; Decap dropped (it edits files only, can't manage people or competitions) |
