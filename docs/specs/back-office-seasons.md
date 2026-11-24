# Spec: Back office — Season dates (first back-office screen)

> **Version:** 0.1 (draft) · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Draft, waiting for owner review

## 1. Purpose

The owner asked (2026-11-24) for season dates to be configurable from the back office instead of
being edited in code. Season dates decide what the Robot tab shows ("This season", "Starts
soon", "Past season") and, later, when a season's leaderboard opens and closes (M4 spec FR-20,
§14.6–14.7).

There is no back office yet: `apps/admin` is empty, and accounts and the database arrive with
M5. This is the first back-office screen, so it also sets how the back office is hosted and how
admins sign in. It is kept deliberately small: one screen, one kind of content.

## 2. Scope

**In scope**
- A back-office screen where an admin changes a season's **start and end dates**.
- Admin sign-in, and a review step before a change goes live.
- Where the back office is hosted, kept apart from the public site.

**Out of scope (later specs)**
- Creating new seasons, choosing courses, uploading badges (still pull requests for now).
- Editing lessons, worlds or translations in the back office (same approach later, ADR-0004).
- AI generation, scoring, coach verification and the other back-office jobs in CLAUDE.md §3.

## 3. Users and journeys

**Admin (the owner, or a trusted content editor)**
1. Opens `admin.robotsforall.org.za` on a laptop or phone and signs in.
2. Chooses **Seasons → Season 1: Rhino Patrol**.
3. Changes the start date to 2026-12-01 and the end date to 2027-12-08, and taps **Save for review**.
4. The back office opens a pull request that changes only `content/seasons/rhino-patrol.json`. CI runs the usual checks (valid dates, end not before start, courses exist).
5. The owner (or a second admin) approves and merges. The site redeploys in about 2 minutes, and phones pick up the new dates the next time they are online (service worker update).

## 4. Functional requirements

| ID | Requirement |
|---|---|
| BO-1 | The back office lists every season (number, name, dates, state today) |
| BO-2 | An admin can change a season's start and end dates with date pickers; the end can't be before the start (checked in the form and again in CI) |
| BO-3 | Saving never changes the live site directly: it opens a pull request that changes only that season's JSON file, with the admin's name in the description |
| BO-4 | A change goes live only after a pull request review and a green CI run (same gate as all content, CLAUDE.md §8) |
| BO-5 | Only listed admins can sign in; everyone else sees nothing of the back office |
| BO-6 | The back office runs on its own hostname and is never linked from, or bundled into, the public site (CLAUDE.md §10) |
| BO-7 | Every change is recorded in Git history: who, what, when |

## 5. Non-functional requirements

- **Public site unchanged:** no new JavaScript, requests or hostnames for learners; the season dates stay in the static build, so offline and zero-rating are not affected.
- **Accessible:** WCAG 2.2 AA (keyboard, labels, contrast); works at 360 px.
- **Cost:** R0 at our scale (free tiers only).
- **Languages:** the back office is English only (admins), so i18n is not required there; season names and texts the learners see stay in `content/i18n`.

## 6. Technical architecture

### 6.1 Options

| | A. Git-based CMS (Decap CMS) | B. Small custom admin page | C. Dates in a database, read at runtime |
|---|---|---|---|
| How it works | An admin app edits `content/seasons/*.json` through GitHub and opens a PR ("editorial workflow") | Our own Svelte page with a date form; a Cloudflare Pages Function opens the PR through the GitHub API | Dates in Postgres (M5); the public site fetches them when online |
| New code | Config file (~40 lines) + sign-in proxy | Form + function (~300 lines) + tests | DB table, API, caching, fallback |
| Review gate | Built in (PR) | Built in (PR) | Must be built |
| Learner site | Unchanged | Unchanged | New runtime request; offline needs a cached copy; one more thing to zero-rate |
| Licence / size | MIT; ~1.5 MB admin app (admins only, never on the public site) | Ours | Ours |
| Grows into | Lessons, worlds, translations (ADR-0004 already names Decap/Keystatic) | Each screen built by hand | Needs M5 first |

### 6.2 Recommendation

**Option A, Decap CMS**, as ADR-0004 foresaw ("a Git-based CMS such as Decap or Keystatic can sit
on top of these same files"). Keystatic was considered; its GitHub mode needs a server runtime,
while Decap is a static page plus a small sign-in proxy, which fits Cloudflare Pages.

- `apps/admin`: a static page that loads Decap from **our own domain** (vendored, version pinned, licence recorded) and a `config.yml` with one collection, `seasons`, whose only editable fields are `from` and `to` (date widgets). `id`, `number` and `courses` are shown read-only.
- **Hosting:** a second Cloudflare Pages project (`robot-for-all-admin`) on `admin.robotsforall.org.za`, deployed from `apps/admin` by CI. Not on the public hostname.
- **Sign-in, two layers:**
  1. **Cloudflare Access** in front of the whole admin hostname (free up to 50 users): only listed email addresses get in, with a one-time code.
  2. **GitHub sign-in** for Decap, through a small OAuth proxy (a Cloudflare Pages Function in the admin project). Decap acts as the admin's own GitHub account, so GitHub permissions and history apply.
- **Publishing:** `publish_mode: editorial_workflow`. Saving creates a branch and pull request; CI runs; a person merges.
- Needs a new **ADR-0009 (back-office hosting and sign-in)** in the first PR.

### 6.3 Data model

No change: `content/seasons/<id>.json` (`from`, `to` as YYYY-MM-DD, South African dates) stays the single source of truth and is checked at build (`packages/sim/src/season.ts`).

## 7. Security, privacy and child safety

- **No learner data** is involved. Admin personal data: email addresses (Cloudflare Access list) and GitHub usernames. POPIA basis: legitimate interest / contract with staff and volunteers; listed in the privacy notice.
- **Threat notes:**
  - *Stolen admin session* → Access and GitHub both require sign-in; GitHub 2FA required for admins; every change is a PR that a second person merges.
  - *Leaked OAuth client secret* → stored only as a Cloudflare secret; the OAuth app asks for the smallest scope Decap supports: `public_repo` while the repository is public (`repo` would reach every private repository the admin can see, so avoid it); rotate on suspicion.
  - *Malicious content in a PR* → the same CI checks as all content; only the two date fields are editable in the form.
  - *Admin app exposed to the public* → separate hostname behind Access; `robots: noindex`; never linked from the public site.
  - *Supply chain* → Decap vendored at a pinned version and served from our domain; dependency scanning in CI.
- **Secrets:** the GitHub OAuth client secret lives in Cloudflare environment variables only (CLAUDE.md §7).

## 8. Acceptance criteria

- [ ] An admin listed in Cloudflare Access can sign in at `admin.robotsforall.org.za`; anyone else is refused before any back-office page loads.
- [ ] Changing Season 1's dates and saving opens a pull request that changes only `content/seasons/rhino-patrol.json`.
- [ ] An end date before the start date can't be saved, and CI fails if one gets into a file anyway.
- [ ] After the PR is merged, the Robot tab shows the right state for the new dates (unit test on `seasonState`, e2e on the banner).
- [ ] The public site's pages, bundle size and requests are unchanged (size budget and CSP checks pass).
- [ ] Decap's licence and version are recorded; no third-party CDN is used.

## 9. Work plan for Claude Code

1. **ADR-0009 + `apps/admin` skeleton**: Decap vendored, `config.yml` with the seasons collection (dates only), CI job that builds the admin site, unit test that the config only allows `from`/`to`. ⏸ owner review.
2. **Owner actions** (§13), then the OAuth proxy function and the deploy job for `robot-for-all-admin`. ⏸ owner tries a date change end to end.
3. **Test-plan rows**: sign-in refused for an unlisted email; date change on a phone; PR and deploy.

## 10. AI opportunities · 11. Revenue notes · 12. Risks · 13. Owner actions

- **AI:** later, the same back office can open AI-drafted content as PRs for review (CLAUDE.md §8).
- **Revenue:** none directly; sponsored seasons (M4 §11) will need dates the owner can set quickly.
- **Risks:** Decap's GitHub sign-in needs an OAuth proxy we host (small, but ours to maintain); if editors find PRs confusing, a "Publish" button can be added for the owner only, still through CI.
- **Owner actions (step 2):**
  1. Add `admin.robotsforall.org.za` as a custom domain for a new Cloudflare Pages project.
  2. Turn on Cloudflare Access (Zero Trust, free plan) for that hostname and list the admin emails.
  3. Create a GitHub OAuth app (callback on the admin hostname) and put its client ID and secret into the admin project's Cloudflare environment variables.
  4. Require 2FA for everyone with write access to the repository.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft, after the owner asked for season dates in the back office |
