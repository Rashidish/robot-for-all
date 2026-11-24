# Spec: Back office — Review and publishing for templates, worlds and courses, and translations

> **Version:** 0.1 (draft) · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Draft, waiting for owner review
> Extends `docs/specs/back-office-content-review.md` (lessons, built) to the other content types, as the owner asked (2026-11-24, "go ahead with 1"). Same rules: ADR-0004, ADR-0009, ADR-0012.

## 1. Purpose

Lessons now go through review in the back office. The other content learners see does not:

| Content | Where | Status today | Problem |
|---|---|---|---|
| **Templates** (printable A4 sheets) | `content/projects/<lesson>/templates/<name>.ts` (code) | none | Production publishes the templates of **every** lesson, including drafts that were never reviewed |
| **Worlds and courses** (Robot tab) | `content/worlds/<id>.json` | none | All 14 show on production without any review record |
| **Translations** | `content/i18n/<lang>.json`, `content/lessons/<id>/index.<lang>.md` | English only | No other language exists yet; nothing checks a translation before it goes live |

## 2. Proposal

### 2.1 Templates follow their lesson (no separate review)
Templates are TypeScript, written and changed by pull request, not in the back office. They are
part of the lesson: they are reviewed **with it**, and are public **only when their lesson is**.
- **Fix:** production builds only the template pages of published lessons (drafts preview shows all).
- **Checklist:** a seventh tick on the lesson checklist: *"Templates: printed at 100 % and measured (the 50 mm square is 50 mm); fold and cut lines right"*.
- **Build test:** the build tester already builds from the printed lesson and templates; their note says which printer.

### 2.2 Worlds and courses get a status
- Each world file gains `status` (`draft` / `in_review` / `published`) and `reviewed_by`, checked by `packages/sim` like lessons. Production shows only published worlds; the drafts preview shows all.
- **Build rules:** a published lesson may only open a published world; a season can only be current if its three courses are published; a published course must print (Print course) without errors.
- **Review checklist** (reviewer ticks): the challenge text is clear for the grade band; a sensible program can finish it on screen (the unit tests prove one exists); missions and points are fair; it fits a classroom floor when printed (size and tile count shown); for seasons, the theme and words are right for children.
- **Build test (optional for worlds, required for courses):** someone builds it on the floor from Print course; `build_tested_by` as for lessons.
- **Back office:** **Content → Worlds & courses**, the same screens and flow as Lessons (send for review, approve, ask for changes, build test, unpublish, merge with the ADR-0012 checks, which extend to "only the status lines of one world file").

### 2.3 Translations (screens built when the first second language starts)
- **Lesson translations** (`index.<lang>.md`) carry their own front matter `status` and `reviewed_by`; a translated lesson shows only when both it and the English lesson are published; otherwise learners see English.
- **Interface words** (`content/i18n/<lang>.json`): a language is switched on for learners only when every key is translated and the language is approved; `content/i18n/languages.json` lists each language's status.
- **Who reviews:** a reviewer who reads that language. Profiles gain **languages I review** (e.g. isiZulu); the database refuses an approval from a reviewer without that language. The translator who drafted it can't approve it.
- **Checklist:** meaning kept (not word for word); safety notes exact; words a child in that grade knows; names of parts and tools as used locally; nothing left in English by mistake.
- **AI translations** (CLAUDE.md §8) land as drafts in this queue, like any AI content.

## 3. Requirements

| ID | Requirement |
|---|---|
| MC-1 | Production builds template pages only for published lessons (drafts preview: all) |
| MC-2 | The lesson checklist has the templates tick; approve needs it |
| MC-3 | World files have `status` and `reviewed_by` (and `build_tested_by` for courses); the build refuses a published lesson pointing to an unpublished world |
| MC-4 | Production's Robot tab lists only published worlds and courses; a season shows as current only when its three courses are published |
| MC-5 | Content → Worlds & courses works like Content → Lessons, with its own checklist, and the ADR-0012 merge check accepts "status lines of one world file" |
| MC-6 | Translations: per-file status for lessons, per-language status for interface words, reviewers with that language only, translator can't approve their own; screens built with the first second language |
| MC-7 | Every decision is in `content_reviews` (content type `lesson`, `world` or `translation`) and the audit log |

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
- [ ] A world goes through send for review → approve (→ build test for courses) → merge in the back office, with the same refusals as lessons.
- [ ] (With the first second language) a translated lesson shows only after a reviewer who reads that language approves it.

## 6. Work plan

1. ⏸ Owner decisions (§7).
2. Templates follow their lesson; the seventh tick (small PR).
3. World status in `packages/sim` and the build; production filter; migration of the 14 existing worlds (per decision 1).
4. Content → Worlds & courses screens; merge check for world files; database content type `world`.
5. Translations: profile languages and database rules now; screens with the first second language.

## 7. Owner decisions

1. **The 14 worlds and courses that are live today (7 launch worlds, 7 courses):** (a) **start them all as `draft`**, like lessons, so the Robot tab on production is empty until each is reviewed, or (b) **mark them `published` with `reviewed_by: "Owner (initial set)"`** so nothing disappears, and review new ones from now on. (Recommended: **b** for the 7 launch worlds the lessons open, **a** for the 7 courses, including Season 1, which nobody has reviewed yet.)
2. **Translations now or later:** build the translation screens **now**, or **when the first second language starts** (recommended: later; nothing to review yet).
3. **Which language comes first** (for planning): isiZulu, isiXhosa, Afrikaans, Sesotho, or another.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft |
