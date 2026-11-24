# Spec: Back office — Review and publishing for templates, worlds and courses, and translations

> **Version:** 0.4 · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-24): option B, a withdraw function for all live content, isiZulu first
> Extends `docs/specs/back-office-content-review.md` (lessons, built) to the other content types, as the owner asked (2026-11-24, "go ahead with 1"). Same rules: ADR-0004, ADR-0009, ADR-0012.

## 1. Purpose

Lessons now go through review in the back office. The other content learners see does not:

| Content | Where | Status today | Problem |
|---|---|---|---|
| **Templates** (printable A4 sheets) | `content/projects/<lesson>/templates/<name>.ts` (code) | none (they follow their lesson) | Already right: production builds templates only for published lessons (checked 2026-11-24; v0.1 wrongly said otherwise). Missing: a print check in the review, and a way to withdraw one template |
| **Worlds and courses** (Robot tab) | `content/worlds/<id>.json` | none | All 14 show on production without any review record |
| **Translations** | `content/i18n/<lang>.json`, `content/lessons/<id>/index.<lang>.md` | English only | No other language exists yet; nothing checks a translation before it goes live |

## 2. Proposal

### 2.1 Templates follow their lesson (no separate review)
Templates are TypeScript, written and changed by pull request, not in the back office. They are
part of the lesson: they are reviewed **with it**, and are public **only when their lesson is**.
- **Already so:** production builds only the template pages of published lessons (drafts preview shows all); a test now guards it.
- **Checklist:** a seventh tick on the lesson checklist: *"Templates: printed at 100 % and measured (the 50 mm square is 50 mm); fold and cut lines right"*.
- **Build test:** the build tester already builds from the printed lesson and templates; their note says which printer.

### 2.2 Worlds and courses get a status
- Each world file gains `status` (`draft` / `in_review` / `published`) and `reviewed_by`, checked by `packages/sim` like lessons. Production shows only published worlds; the drafts preview shows all.
- **Build rules:** a published lesson may only open a published world; a season can only be current if its three courses are published; a published course must print (Print course) without errors.
- **Review checklist** (reviewer ticks): the challenge text is clear for the grade band; a sensible program can finish it on screen (the unit tests prove one exists); missions and points are fair; it fits a classroom floor when printed (size and tile count shown); for seasons, the theme and words are right for children.
- **Build test (recorded when done, not required to publish):** someone builds it on the floor from Print course; `build_tested_by` as for lessons. Not required, because the live courses stay published under decision B without one; the floor check is test-plan row B21.
- **Back office:** **Content → Worlds & courses**, the same screens and flow as Lessons (send for review, approve, ask for changes, build test, unpublish, merge with the ADR-0012 checks, which extend to "only the status lines of one world file").

### 2.3 Translations (screens built when the first second language starts)
- **Lesson translations** (`index.<lang>.md`) carry their own front matter `status` and `reviewed_by`; a translated lesson shows only when both it and the English lesson are published; otherwise learners see English.
- **Interface words** (`content/i18n/<lang>.json`): a language is switched on for learners only when every key is translated and the language is approved; `content/i18n/languages.json` lists each language's status.
- **Who reviews:** a reviewer who reads that language. Profiles gain **languages I review** (e.g. isiZulu); the database refuses an approval from a reviewer without that language. The translator who drafted it can't approve it.
- **Checklist:** meaning kept (not word for word); safety notes exact; words a child in that grade knows; names of parts and tools as used locally; nothing left in English by mistake.
- **AI translations** (CLAUDE.md §8) land as drafts in this queue, like any AI content.

### 2.4 Withdraw anything that is live (owner decision 2026-11-24)
Any live item can be taken down quickly and brought back later, without editing it:
**lessons, single templates, worlds and courses, seasons, and a whole language**.
- **One list:** `content/site/withdrawn.json`, e.g.
  `{ "items": [{ "type": "template", "id": "p1-crank-01/rhino-parts", "reason": "Wrong fold line on the leg", "since": "2026-11-24" }] }`.
  Types: `lesson`, `template` (`<lesson>/<sheet>`), `world`, `season`, `language` (e.g. `zu`).
- **The build:** production leaves out everything on the list (a withdrawn lesson's page, templates and answer sheet; a template's page; a world in the Robot tab; a season's grouping; a language's pages and switch). A published lesson whose world is withdrawn still shows; its "open in the Robot tab" link falls back to the plain micro:bit view (so a world can be withdrawn without taking lessons down). The drafts preview shows withdrawn items with a "Withdrawn" label.
- **The back office:** a **Withdraw** button (reason required) on every live item, and **Restore** on withdrawn ones; a **Content → Withdrawn** list of everything taken down, with who, when and why. Owners and reviewers can withdraw and restore anything; competition managers also worlds, courses and seasons.
- **Fast and safe:** withdrawing changes only one entry in that list; the ADR-0012 merge check accepts "one item added to or removed from the withdrawn list", so it goes live as soon as CI passes (about 5 minutes), without a second approval on GitHub. Every withdraw and restore is in `content_reviews` (decisions `withdrawn`, `restored`) and the audit log.
- Unpublishing a lesson (status back to draft) still exists for "needs more work"; withdrawing is for "take it down now, unchanged".

### 2.5 Add and remove languages (owner request 2026-11-24)
**Content → Languages** (owners; translators can see it) lists every language with its status
(`draft` / `in_review` / `published`, or withdrawn), how much of the interface is translated, and
how many lessons are translated and approved.
- **Add a language:** pick it (South Africa's official languages are offered by name; any other by its ISO code), give its name in English and in the language itself (e.g. "isiZulu"). The back office opens a pull request adding it to `content/i18n/languages.json` as `draft`, with an empty interface file. A draft language is never offered to learners on production; the drafts preview shows it so translators and reviewers can work.
- **Publish a language:** when every interface word is translated and a reviewer who reads it approves, the language turns `published` and learners can switch to it. Lesson translations are approved one by one (§2.3); untranslated lessons show in English.
- **Take a language off the site:** **Withdraw** (§2.4) hides it at once and keeps everything.
- **Remove a language:** owners only, after typing its name to confirm. If it was never published, the pull request deletes its files (they stay in Git history and can be restored); if it was published, it must be withdrawn first. Adding and removing are recorded in the audit log (`language.add`, `language.remove`).
- English (the source) can't be removed or withdrawn.

### 2.6 Building it, and finding an isiZulu reviewer (owner: "plan for a reviewer", 2026-11-24)

**Three PRs:**
- ✅ *(built 2026-11-24)* **A. Language list and the Languages screen:** `content/i18n/languages.json` (English as the source, published), checked by the build; Content → Languages (list, how complete each is, add and remove as pull requests a person merges on GitHub, because they change several files); each reviewer's **languages** on their profile, and the database refuses a translation approval from someone without that language.
- **B. The site in a second language:** pages for each published language at `/<code>/…` (English stays at `/`), a language switch remembered on the device, only the chosen language's words downloaded (ADR-0003); draft languages only in the drafts preview.
- **C. isiZulu text and review:** AI-drafted isiZulu for the interface words, then lessons (Phase 1 first), all as drafts marked AI-drafted; the translation review screens (§2.3); a language is published only when complete and approved.

**Finding an isiZulu reviewer** (nothing in isiZulu goes live until this is done):
- **Who:** a first-language isiZulu speaker, ideally a Foundation or Intermediate Phase teacher (Grades 3–7) who teaches maths, science or Coding and Robotics, so words suit children and the classroom; comfortable with simple technical words (motor, battery, switch) and with saying where isiZulu uses an English loan word.
- **Two people, not one:** a **translator** (checks and fixes the AI draft) and a separate **reviewer** (approves), so nobody approves their own work, as for lessons.
- **Where to look (owner actions):**
  1. Teachers already interested in the platform, especially in KwaZulu-Natal and Gauteng (ask in the pilot schools and clubs).
  2. University isiZulu or education departments (e.g. UKZN, Wits, UNISA): lecturers or postgraduate students, sometimes as a community-engagement project.
  3. The South African Translators' Institute (SATI) directory of accredited isiZulu translators (paid).
  4. Provincial education department subject advisers, for word choices that match CAPS materials in isiZulu.
- **What they need:** a back-office account with the Translator or Reviewer role and **isiZulu** on their profile, the translation checklist (§2.3), and 1–2 hours a week; start with the interface words (about 490 short phrases) and the first three Phase 1 lessons.
- **Owner decisions still open:** volunteer, paid per word, or a small honorarium; who checks the reviewer's own work for the first lesson (a second speaker on a sample). Money is the owner's decision; no rates are assumed here.
- **Test plan:** row B30 (a first-language speaker reads the isiZulu interface and three lessons on a phone; children in Grade 4 understand the safety notes).

## 3. Requirements

| ID | Requirement |
|---|---|
| MC-1 | Production builds template pages only for published lessons (drafts preview: all); already true, guarded by a test |
| MC-2 | The lesson checklist has the templates tick; approve needs it |
| MC-3 | World files have `status`, `reviewed_by` and `build_tested_by`; a published world needs `reviewed_by`; a published lesson whose world isn't published opens the plain micro:bit instead (as for withdrawn worlds) |
| MC-4 | Production's Robot tab lists only published worlds and courses; a season shows as current only when its three courses are published |
| MC-5 | Content → Worlds & courses works like Content → Lessons, with its own checklist, and the ADR-0012 merge check accepts "status lines of one world file" |
| MC-6 | Translations: per-file status for lessons, per-language status for interface words, reviewers with that language only, translator can't approve their own; screens built with the first second language |
| MC-7 | Every decision is in `content_reviews` (content type `lesson`, `world`, `template`, `season` or `translation`) and the audit log |
| MC-9 | Content → Languages: add a language (draft, empty interface file), publish when complete and approved, withdraw, and remove (owners, confirmed by typing its name; published ones withdrawn first); English can't be removed |
| MC-8 | Withdraw / restore any live lesson, template, world, season or language through `content/site/withdrawn.json`; production leaves withdrawn items out; reason required; Content → Withdrawn lists them |

## 4. Security, privacy and child safety

No new personal data except reviewers' **languages** (shown to other admins only). Threats as in
the lessons spec; additionally: *a world switched to published with a broken course* → the build's
course checks and the print check refuse it; *a mistranslated safety note* → the translation
checklist's "safety notes exact" tick is required, and only a reviewer who reads the language can approve.

## 5. Acceptance criteria

- [ ] On production, `/templates/<lesson>/…` exists only for published lessons.
- [ ] Approving a lesson needs the templates tick.
- [ ] A world marked published shows on production; a draft one only on the drafts preview.
- [ ] The build fails if a published lesson opens a draft world.
- [ ] A world goes through send for review → approve → merge in the back office (a build test can be recorded any time), with the same refusals as lessons.
- [ ] (isiZulu) a translated lesson shows only after a reviewer who reads isiZulu approves it; the isiZulu interface is off on production until the language is approved.
- [ ] Withdrawing a template, lesson, world, season or language from the back office takes it off production after CI, and Restore brings it back; both are recorded.

## 6. Work plan

1. ✅ Owner decisions (§7).
2. ✅ *(built 2026-11-24)* **Withdraw** for every content type (`content/site/withdrawn.json`, build filters, back-office Withdraw / Restore / Withdrawn list, merge check), the seventh (templates) tick, and a test that production builds templates only for published lessons.
3. ✅ *(built 2026-11-24)* **World status** in `packages/sim` and the build: the 14 live worlds and courses marked `published` with `reviewed_by: "Owner (initial set)"`; Content → Worlds & courses screens.
4. **Languages and isiZulu:** Content → Languages (add, publish, withdraw, remove; §2.5); the language switch and per-language status (off on production until approved); profile languages and the database rules; translation screens; then **AI-drafted isiZulu translations** of the interface words and lessons as **drafts** (`ai_generated: true`), each needing a reviewer who reads isiZulu before it shows.

## 7. Owner decisions (2026-11-24)

1. ✅ **B:** the 14 live worlds and courses stay published, recorded as `reviewed_by: "Owner (initial set)"`; new ones are reviewed from now on.
2. ✅ **Withdraw function** for any live lesson, template, world, course, season or language (§2.4).
3. ✅ **isiZulu** is the first second language; the translation screens are built for it.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft |
| 0.2 | 2026-11-24 | Correction: templates already follow their lesson on production. Approved: B (live worlds stay published as the initial set), withdraw for all live content (§2.4), isiZulu first |
| 0.3 | 2026-11-24 | §2.5 add and remove languages (owner request) |
| 0.4 | 2026-11-24 | §2.6 building the languages step in three PRs; plan for finding an isiZulu reviewer (owner request) |
