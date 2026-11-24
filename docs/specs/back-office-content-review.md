# Spec: Back office — Content review and publishing (lessons first)

> **Version:** 0.2 · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-24): Option B, drafts preview yes
> Part of `docs/specs/back-office.md` (module "Content → Lessons", build order step 4). Depends on ADR-0004, ADR-0009, ADR-0010, ADR-0011.

## 1. Purpose

Today **no lesson is published**: all 22 are `draft`, and production hides drafts (ADR-0004 rule
4). Publishing needs a person to review each lesson (`reviewed_by`) and someone to build it from
the printed lesson (`build_tested_by`), and every AI-drafted lesson must be reviewed (CLAUDE.md
§8). Right now that means editing front matter in GitHub. This module lets reviewers and build
testers do it in the back office, with a checklist, a record of every decision, and the same
"nothing goes live without a person" rule.

## 2. Scope

**In scope:** lessons: the queue, the review checklist, approve / ask for changes, recording a
build test, unpublishing; a private preview of drafts for reviewers.
**Later (same pattern):** templates, worlds and courses, robot profiles, translations.
**Out of scope:** editing lesson text in the back office (still in GitHub or by Claude Code as pull
requests); AI generation (its drafts land in this queue).

## 3. Users and journeys

1. **Send for review** (content editor): opens **Content → Lessons**, picks `p2-art-01` (draft), taps **Send for review** → `status: in_review` (pull request).
2. **Review** (reviewer, not the person who sent it): opens the lesson from the **Review queue**. Sees the lesson as learners will (the private preview), the answer sheet, templates and diagrams, plus the automatic checks. Ticks the checklist (§4) and either:
   - **Approves** → `status: published`, `reviewed_by: <their reviewer name>`, or
   - **Asks for changes** with a note → `status: draft`; the note is kept and shown to editors.
3. **Build test** (build tester): after building the lesson from the printed handbook, records **Built and works**, with notes → `build_tested_by: <their name>`. Photos stay private (not in this version).
4. **Publish**: a lesson goes live only when it is approved **and** build-tested; the public build already enforces this (schema rule).
5. **Unpublish** (reviewer or owner): takes a live lesson down with a reason → `status: draft`.

## 4. The review checklist

Automatic (shown as passed or failed, from the same checks as the build): five PRIMM sections in
order; 2–4 outcomes; 3–5 assessment lines starting "I can"; at least one safety note; links to
lessons that exist; images have alt text; templates, starter program and world exist; the answer
sheet fits one page.

Reviewer ticks (all required to approve):
1. **Safety**: adult help is marked where needed; no coin or button cells; no mains; sharp tools only with an adult.
2. **Electrical design** (Phase 2+): battery only, low voltage, current within the parts' limits (CLAUDE.md §8).
3. **Age and language**: right for the grades; plain words; no learner personal data asked for.
4. **CAPS links** look right (the "to confirm" ones are confirmed or removed).
5. **Parts and cost**: cheap, with substitutes; the cost estimate is believable.
6. **AI-drafted**: if `ai_generated: true`, the reviewer has read every section, not only the checklist.

## 5. Functional requirements

| ID | Requirement |
|---|---|
| CR-1 | The Lessons screen lists every lesson with status, grades, phase, `reviewed_by`, `build_tested_by`, and the open pull request if one is waiting |
| CR-2 | Every status change is a pull request changing only that lesson's front matter (ADR-0009); the text of the lesson is never touched by these actions |
| CR-3 | A reviewer can't approve a lesson they sent for review (only a super admin can override, with a reason) |
| CR-4 | Approve needs every checklist tick and every automatic check passed |
| CR-5 | Decisions (approve, changes asked, build test, unpublish) with checklist and notes are stored in the database (`content_reviews`) and the audit log |
| CR-6 | Reviewers see drafts as learners will see them, on a private preview (§6.2) |
| CR-7 | Names written into the public repository are the person's **reviewer name** (chosen once, e.g. "R. Ishmail"), never their email |

## 6. Technical notes

### 6.1 Data
- Lessons stay in Git (front matter `status`, `reviewed_by`, `build_tested_by`).
- New table `content_reviews (id, content_type, content_id, decision, checklist jsonb, notes, user_id, pull_request, at)` with row-level security: editors, reviewers, build testers and owners read; writes only through functions that check the role and the "not your own" rule.
- New column on back-office people: `reviewer_name` (shown publicly in `reviewed_by` / `build_tested_by`).

### 6.2 Private preview of drafts
Production hides drafts. Reviewers need to see them as learners will. **Proposal:** CI also
deploys `main` with drafts shown to a second Pages alias, **`drafts.robotsforall.org.za`**, behind
the same Cloudflare Access list as the back office (free). The back office links each lesson to
its page there.

### 6.3 Who merges? (decision needed, §10)
Branch protection asks for one approval on GitHub for every pull request. For non-technical
reviewers that is a second step outside the back office.

- **Option A, two steps:** the reviewer approves in the back office; an owner then approves and merges the pull request on GitHub. Simple, no change to ADR-0009, but slow and needs GitHub accounts.
- **Option B, the back office merges (recommended):** after a reviewer approves in the back office (MFA, role checked, not their own lesson, recorded), the GitHub App merges the pull request **once CI is green**, and only pull requests the back office itself opened that change only front matter status fields. The ruleset keeps "CI must pass" for everyone and "1 approval" for everything else; the App gets merge rights through a narrow bypass. This needs **ADR-0012** (amends ADR-0009's "a person merges on GitHub": the person approves in the back office instead).

## 7. Security, privacy and child safety

- **Personal data:** reviewer names become public in the repository (agreed by the person when they choose it); emails never do. Review notes may name staff, not learners.
- **Threat notes:**
  - *A reviewer publishes their own lesson* → checked in the database function, not only the page; overrides by a super admin with a reason.
  - *Option B: the App merges something it shouldn't* → it merges only pull requests it opened, with a diff limited to the front matter status fields (checked before merging), only after green CI and a recorded approval; anything else still needs a person on GitHub.
  - *Drafts leak* → the drafts preview is behind Cloudflare Access; `noindex`; not linked from the public site.
  - *Unsafe lesson goes live* → the checklist's safety and electrical ticks are required, and build testing is required by the schema.

## 8. Acceptance criteria

- [ ] An editor sends a draft for review; a different reviewer approves it with all ticks; after the build test is recorded and the pull request merges, the lesson appears on the production site.
- [ ] A reviewer can't approve their own lesson; the database refuses it even if the page is bypassed.
- [ ] Approve is refused while any automatic check fails or any tick is missing.
- [ ] "Ask for changes" keeps the note and returns the lesson to draft.
- [ ] Unpublishing takes the lesson off production after the merge.
- [ ] Every decision is in `content_reviews` and the audit log; no email appears in the repository.
- [ ] The drafts preview is refused without Cloudflare Access.

## 9. Work plan

1. ✅ Owner decisions (§10); ADR-0012.
2. ✅ Database: `content_reviews`, `reviewer_name`, decision functions with the "not your own" rule (PGlite tests). *(2026-11-24, migrations 0003–0004)*
3. ✅ Drafts preview deploy behind Access. *(2026-11-24, `deploy.yml`; owner set-up `docs/deploy.md` §5 step 8)*
4. ✅ Back office: Lessons list and review queue, checklist, approve / changes / build test / unpublish, pull requests and merging (Option B). *(2026-11-24: `/lessons/`, `/lessons/<id>/`, `/profile/`)*
5. Test-plan rows; then the same flow for templates, worlds and translations.

## 10. Owner decisions (2026-11-24)

1. ✅ **Option B:** the back office merges its own front-matter pull requests after green CI and a recorded reviewer approval (ADR-0012).
2. ✅ **Drafts preview** at `drafts.robotsforall.org.za`, behind Cloudflare Access.
3. **Reviewer names:** each person chooses the name shown publicly when they first review (e.g. "R. Ishmail", or a role like "Reviewer 3"); an email is never accepted. The owner can still decide roles only, by asking.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft |
| 0.2 | 2026-11-24 | Approved: Option B (ADR-0012), drafts preview; reviewer names chosen by each person |
