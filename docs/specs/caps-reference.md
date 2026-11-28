# Spec: CAPS reference and AI-suggested CAPS links

> **Version:** 0.1 · **Date:** 2026-11-28 · **Owner:** Rashid Ishmail · **Status:** Draft for owner review
> Depends on: lesson format (ADR-0004), back office review flow (`docs/specs/back-office.md`, `docs/specs/back-office-content-review.md`), Junior missions (`docs/specs/junior.md` FR-9), Machines topics. Seed list: `docs/caps-foundation-codes.md`.

## 1. Purpose

Every lesson, project, Machines topic, Junior mission and story should point to the **same CAPS codes, written the same way**. Today:
- lessons type free text in `syllabus_links`;
- Junior checks codes against a pattern hard-coded in `packages/sim/src/junior.ts`.

**Owner decisions (2026-11-28)**
1. Build a CAPS reference for **all grades, R–9**, used whenever lessons or projects are created, and updated when CAPS changes.
2. **AI suggests the CAPS links** for new content, as during development: it reads the content and picks matching codes. Following CLAUDE.md §8, a person confirms them before publishing.

## 2. The reference (data)

One file per phase in `content/caps/`, checked at build:

```json
{
  "phase": "foundation",
  "grades": [0, 1, 2, 3],
  "source": "DBE CAPS Coding and Robotics, Foundation Phase (gazetted 2024)",
  "version": "2024",
  "updated": "2026-11-28",
  "codes": [
    {
      "code": "R.3",
      "area": "robotics",
      "summary": "A robot is made of parts, each with a purpose",
      "grades": [1, 2, 3]
    }
  ]
}
```

- `foundation.json` (R–3) comes from `docs/caps-foundation-codes.md`, which then becomes a page generated from the data.
- `intermediate.json` (4–6) and `senior.json` (7–9) need the **official gazetted CAPS PDFs** (owner action; the 2021 drafts online aren't final).
- Each entry has: the code, its content area, a short summary in our own words, and the grades it applies to (CAPS's N/A cells are left out).

## 3. Where it's used

| Content | Field | Check |
|---|---|---|
| Lessons and projects | `caps: [codes]` (alongside `syllabus_links`, which stays for other subjects' links, e.g. Maths) | Every code exists in the phase for the lesson's grades |
| Junior missions and stories | `caps` (exists) | Same check; replaces the hard-coded pattern |
| Machines topics | `caps` (new, optional) | Same check |

- **Not applicable to the grade:** the build fails, e.g. R.3 on a Grade R lesson, D.10 in Grades R–3.
- **When CAPS changes:** the reference is updated (new `version` and `updated` date). The build lists every item whose codes no longer exist or no longer apply, so editors can fix them.

## 4. AI-suggested links (back office)

1. An editor creates or edits a lesson, project, topic, mission or story in the back office.
2. **Suggest CAPS codes** sends the item's words (title, outcomes, body; no personal data) and the reference codes for its grades to the AI.
3. The AI may only pick codes from that list. Each suggestion comes with a one-line reason: "covers R.5: learners build a robot model from a design".
4. The editor ticks or unticks each suggestion. The chosen codes are saved with `caps_suggested_by: ai` and go through the normal review: `reviewed_by` is required to publish.
5. Batch mode, for existing content: suggest codes for every lesson without `caps`. The suggestions come as one pull request for review.

**Rules**
- AI calls run in the back office only, through the server; keys are never in a page (CLAUDE.md §10).
- The AI never invents a code. Anything outside the list is dropped before the editor sees it.
- A cost cap per day, as for other back-office AI.

## 5. Requirements

| ID | Requirement |
|---|---|
| CR-1 | `content/caps/*.json` with a schema check: unique codes per phase, grades within the phase, summaries ≤ 30 words, `source`, `version` and `updated` set. |
| CR-2 | A shared checker (`packages/settings` or a new `packages/caps`) used by the public build, Junior and the back office. |
| CR-3 | A `caps` field on lessons, projects, Machines topics, missions and stories, validated against the reference for the item's grades. |
| CR-4 | A generated reference page for teachers (`/caps/`), grouped by phase, grade and area; the Lessons list can be filtered by CAPS code. |
| CR-5 | Back office: a code picker filtered by grade, plus **Suggest CAPS codes** (AI, constrained to the list, with reasons), and a batch suggestion run as one PR. |
| CR-6 | On a reference update, a build report lists the items whose codes are missing or no longer apply. |

## 6. Threat notes

| Threat | Mitigation |
|---|---|
| The AI tags content wrongly | Suggestions only from the list, each with a reason; a person confirms; `reviewed_by` before publishing |
| Personal data sent to the AI | Only content words are sent (lessons have no learner data); the existing back-office AI path strips identifiers |
| CAPS wording copied at length | Short summaries in our own words; the reference cites the official document |

## 7. Work plan

⏸ Owner approves this spec and uploads the Intermediate (4–6) and Senior (7–9) CAPS PDFs.

1. **CR-1, CR-2:** the reference format, `foundation.json` from the current list, and the shared checker; Junior switches to it.
2. **Intermediate and Senior data:** codes from the uploaded PDFs, extracted in the planning chat and checked by a person.
3. **CR-3, CR-6:** the `caps` field on all content kinds, the build checks and the update report.
4. **CR-5:** the back-office picker, AI suggestions and the batch run (tag the existing lessons).
5. **CR-4:** the teachers' reference page and the CAPS filter. ⏸ Owner review.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-28 | First draft: one CAPS reference for Grades R–9 as data, checked everywhere; AI suggests links from the list, a person confirms |
