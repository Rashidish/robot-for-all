# Spec: Back office — foundation and module map

> **Version:** 0.5 · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-24); ADR-0009 and ADR-0010 accepted
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
| **Super admin** | Everything every other role can do, plus: give and take away any role (including owner), and **override** the normal checks when there is nobody else to do them (approve their own work, publish without a second reviewer, reopen a closed competition, unlock an account). Every override needs a written reason and is marked in the audit log. The owner (Rashid Ishmail) is the first super admin and so is also the first owner and reviewer. Plus one **break-glass** super admin account for emergencies, kept in a password-manager vault (owner decision 2026-11-24), used only if the main one is lost |
| **Owner** | Run the platform day to day: give and take away roles below owner, change settings, see the audit log |
| **Content editor** | Draft and edit lessons, templates, worlds, courses, seasons, robot profiles and translations; send them for review |
| **Reviewer** | Approve content for publishing (sets `reviewed_by`); can't approve their own drafts (only a super admin can override this) |
| **Build tester** | Record that a lesson was built from the printed lesson and works (sets `build_tested_by`), with notes and photos kept private |
| **Translator** | Translate learner-facing text into a home language; translations go to a reviewer |
| **Competition manager** | Create seasons and competitions, set dates and entry windows, open and close them, publish results |
| **Judge** | Score challenge entries (completion, function, presentation); check top places after server replay |
| **Moderator** | Approve or reject user-generated content (projects, entries, comments) before it is public |
| **Coach verifier** | Check and approve volunteer coaches (identity, police clearance where required); schedule live sessions |
| **Shop manager** | Kit catalogue, prices, suppliers, orders and deliveries |
| **Communications** | Newsletter, parent WhatsApp questions, announcements |
| **Support** | Look up a school, class or teacher account to help; no learner details beyond nicknames |
| **Data protection officer** | Handle POPIA requests (access, correction, deletion), consent records and data breaches |

Every role is checked **on the server** (database row-level security and the back-office API), never only in the page. While the team is small, the super admin holds all roles; roles are handed out as people join.

**Journeys (examples)**
1. *Approve a lesson:* a content editor sends `p2-art-01` for review → a reviewer opens it in **Content → Review queue**, reads the lesson, answer sheet and template previews, ticks the checklist (safety, electrical check, CAPS links, build tested, languages) and approves → the lesson's status becomes `published`, `reviewed_by` is set, and it goes live on the next deploy.
2. *Only one person on the team:* the super admin drafts a fix and approves it themselves with the reason "typo, no second reviewer yet"; the audit log marks it as an override.
3. *Set season dates:* a competition manager opens **Configuration → Seasons → Season 1**, changes the start date and saves → after review it goes live (§6.5).
4. *Set up a competition:* a competition manager creates "Surprise maze day, 14 March 2027": course `bump-maze`, a secret maze number revealed at 09:00, entries 09:00–12:00, Grade 4–6 → schools sign up in the portal → results are replayed on the server, a judge checks the top places, and the manager publishes the results.
5. *Give someone access:* an owner invites a new reviewer by email → they sign in with MFA → the owner sets their roles → the change is in the audit log.

## 4. Module map: every front-office capability and how it is run

Every capability of the public site (CLAUDE.md §3), and everything decided so far, has a back-office home. Content changes go through Git and review (§6.1); people and live data go through the database.

### 4.1 Coverage

| Front-office capability | Back-office module | What admins manage there | When |
|---|---|---|---|
| Lesson player (handbook, slides, answer sheets) | **Content → Lessons** | Draft, edit, review queue, approve → publish, unpublish; status `draft` / `in_review` / `published`; `reviewed_by`, `build_tested_by`; safety and electrical checklist; answer-sheet preview | Before launch |
| Project library and filters | **Content → Library** | Phases, grades, subjects, mechanisms, cost bands, featured projects, lesson order (`next`, prerequisites) | Before launch |
| Printable templates | **Content → Templates** | Template previews at A4, print checks, which lesson uses which template | Before launch |
| Translations / home languages | **Content → Languages** | Languages switched on, translation progress per language, translator assignments, review of translations | With the first second language |
| Block editor and micro:bit | **Configuration → Code editor** | Block set and categories on/off, extension packs (owner reminder: revisit the folder format first), MicroPython firmware and simulator versions, starter programs | Before launch |
| Robot boards | **Content → Robot profiles** | Board profiles and wiring diagrams (ADR-0008), "Test my robot" fixes offered | Before launch |
| 2D simulator, worlds and courses | **Content → Worlds & courses** | Worlds, courses, pieces, missions and points, scoring rules, time limits, print-course checks | Before launch |
| Seasons | **Configuration → Seasons** | Dates (first module, §6.5), three courses per season, badge, sponsor or NGO partner | **First** |
| Challenges and competitions | **Competitions** | Formats (practice, season skills run, surprise maze day, floor showcase); entry windows; grade bands; secret maze numbers and reveal time; school/club/learner leaderboards; results | After M5 |
| Scoring | **Scoring & judging** | Server replay of entries (M4 §13.5), judge scoring (completion, function, presentation), disputes, final results | After M5 |
| Teacher, coach and parent portal | **People → Schools, classes and accounts** | Schools, teachers, coaches, parents, classes; invitations; consent records; account deletion | M5 |
| Progress and badges | **Configuration → Badges** | Badge definitions and rules, parent badges, answer-sheet codes (answer-sheets spec Part B) | M5 |
| Back-office people | **People → Back-office roles** | Invite, give and take away roles, MFA status, sign-in history | **First** |
| AI helper (front office) | **AI → Helper settings** | Daily cost caps per user, cached answers, refusal topics, system prompt versions, usage (no personal data) | M6 |
| AI generation (back office) | **AI → Generation** | Requests for drafts (lessons, templates, translations, worlds); every result lands in the review queue | Later |
| Live group help sessions | **Live sessions** | Coach verification, session schedule, who hosts, safety rules (coach camera on, learner cameras off, no 1:1 chat) | Later |
| User-generated content | **Moderation** | Queue for projects, entries and comments; approve, reject, report handling | With the first uploads |
| Kit and supplies ordering | **Shop** | Kit catalogue, prices, suppliers, stock, orders, delivery | With the kit store |
| Parent engagement | **Communications → Parents** | Weekly WhatsApp question, schedule, parent badges | Later |
| Newsletter | **Communications → Newsletter** | Events, competitions, results, rankings; subscribers (with consent) | Later |
| Privacy and POPIA | **Privacy** | Consent records, access and deletion requests, data retention, breach log | M5 |
| Site settings | **Configuration → Site** | Announcement banner, feature switches (e.g. a module not ready yet), domains and redirects shown read-only | **First** |
| People checks | **Content → People checks** | The deferred checks in `docs/test-plan.md`: who checked what, on which device, result | Before launch |
| Audit | **Audit log** | Every action and every super-admin override, read-only | **First** |
| Usage | **Reports** | Counts without tracking people: lessons opened, templates printed, programs sent (from our own server logs, no third-party analytics) | Later |

### 4.2 Build order

1. **Now:** Foundation (sign-in with MFA, roles with super admin, audit log, admin home), People → Back-office roles, Configuration → Seasons and Site.
2. **Before launch:** Content (lessons review and publishing, library, templates, worlds and courses, robot profiles, code editor settings, people checks).
3. **With M5:** People (schools, classes, accounts), Badges, Privacy.
4. **After M5:** Competitions, Scoring & judging, Moderation.
5. **Later:** AI helper settings (M6), AI generation, Live sessions, Shop, Communications, Reports.

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

- `apps/admin`: **Astro + Svelte** (same stack and shared `packages/ui` components as the front office, ADR-0001), server-rendered in a **Cloudflare Worker** (ADR-0011; the public site stays static on Pages).
- Hostname **`admin.robotsforall.org.za`**, `noindex`, strict CSP, no third-party scripts.
- Reads content from the repository; writes content through a **GitHub App** installed on this repository only (contents and pull requests: write, nothing else). It pushes a new branch and opens a pull request; **branch protection on `main`** (required review and green CI, no bypass for the App) means it can never change the live site by itself. The App's private key is a Cloudflare secret.

### 6.3 Sign-in and roles

- **Supabase Auth** with email sign-in and **required MFA** (authenticator app) for every back-office account. The same accounts system serves the M5 portal, so there is one place to manage people.
- An `admin_roles` table (`user_id`, `role`, `granted_by`, `granted_at`) with row-level security: owners can grant roles below owner; only a super admin can grant owner or super admin. Override actions go through one server function that requires a reason and writes the audit entry.
- **Cloudflare Access** in front of the admin hostname (free up to 50 people; owner decision 2026-11-24), so unlisted people never reach the sign-in page. The app also checks Access's signed header on every server route.

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
  - *Insider misuse* → least-privilege roles; reviewers can't approve their own work; every action audited.
  - *Super admin overrides* → a written reason is required; overrides are marked in the audit log and listed on the admin home for every owner to see; the super admin account needs MFA with a hardware key or authenticator app and its sign-ins alert the owners.
  - *Locked out (lost phone, lost account)* → a vaulted break-glass super admin account (password and MFA recovery codes in a password-manager vault); using it alerts every owner and is reviewed afterwards.
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
- [ ] A super admin can override a check (e.g. approve their own work) only with a written reason, and the audit log marks it as an override.
- [ ] The break-glass account can sign in and its use alerts every owner.
- [ ] Changing Season 1's dates opens a pull request changing only `content/seasons/rhino-patrol.json`; an end before the start can't be saved, and CI fails if one gets into a file.
- [ ] After the merge, the Robot tab shows the right season state for the new dates.
- [ ] The public site's pages, sizes, CSP and requests are unchanged.

## 9. Work plan for Claude Code

1. ✅ **ADR-0009 + ADR-0010** accepted (2026-11-24).
2. **Foundation** *(built 2026-11-24, waits for the owner set-up in `docs/deploy.md` §5: database rules in `packages/db` (2a); admin app as a Cloudflare Worker, ADR-0011 (2b); break-glass sign-in alerts to owners by email still to do, with the email provider)*: `apps/admin` skeleton (sign-in page with MFA, admin home, role checks with the super admin and its overrides, audit log), People → Back-office roles, database migrations for roles and audit log, CI job and tests per role. ⏸ owner actions (§13), then the owner signs in.
3. **Configuration → Seasons** (§6.5) and **Site** settings, with the GitHub App. *(Seasons built 2026-11-24: `apps/admin/src/pages/seasons.astro`; Site settings next.)* ⏸ owner changes a date end to end.
4. **Content review & publishing**: short spec first, then build. ⏸
5. Further modules in the order of §4.2, each with a short spec, following the milestones.

## 10. AI opportunities · 11. Revenue notes · 12. Risks · 13. Owner decisions and actions

- **AI:** AI-drafted content always lands in the review queue (CLAUDE.md §8); the M6 helper's cost caps can be a setting in Configuration.
- **Revenue:** school dashboards, competition packs and sponsored seasons are managed here.
- **Risks:** this brings the database forward from M5 (only for admin accounts at first); a server-rendered admin app is new for this repo; GitHub App setup is a one-off owner task.
- **Owner decisions (2026-11-24):**
  1. ✅ Content in Git through pull requests; operational data in Supabase (brought forward from M5, for back-office accounts first).
  2. ✅ Roles as in §3, with a super admin who covers the first owner and reviewer and can override checks with a reason.
  3. ✅ Cloudflare Access in front of the admin hostname.
  4. ✅ The break-glass super admin account is **vaulted**: its password and MFA recovery codes are kept in a password-manager vault that only the owner (and a named deputy, if any) can open; opening it is itself logged by the vault, and using the account alerts every owner.
- **Owner actions (before step 2):** create the Supabase project (free tier, the region nearest South Africa); add `admin.robotsforall.org.za` to a new Cloudflare Pages project; install a GitHub App on this repository only (contents: write, pull requests: write) and protect `main` (required review and green CI, no bypass); put the keys into Cloudflare secrets; require 2FA for everyone with write access to the repository.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft: season dates only, with Decap CMS |
| 0.2 | 2026-11-24 | Owner: the back office runs all administration and configuration (lesson approval, users and access, competitions). Rewritten as the foundation and module map; seasons become its first module; Decap dropped (it edits files only, can't manage people or competitions) |
| 0.3 | 2026-11-24 | Owner: a super admin covers the first owner and reviewer and can override checks (with a reason, audited); module map extended to every front-office capability and everything discussed (§4.1); more roles (build tester, translator, shop manager, communications, data protection officer) |
| 0.4 | 2026-11-24 | Approved by the owner, with Cloudflare Access in front; decisions recorded in §13; ADR-0009 and ADR-0010 |
| 0.5 | 2026-11-24 | Break-glass account vaulted (owner); ADR-0009 and ADR-0010 accepted |
