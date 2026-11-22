# Spec: Answer sheets and lesson progress records

> **Version:** 0.2 · **Date:** 2026-11-23 · **Owner:** Rashid Ishmail · **Status:** Part A built; Part B approved in principle (owner, 2026-11-23), built with M5
> Depends on: M2 lesson format (ADR-0004), CLAUDE.md §7 (POPIA). Part B needs M5 (accounts and classes).

---

## 1. Purpose

Many classes work from printed lessons with one shared phone or none. Learners need a paper place to answer the lesson's questions, and teachers need that paper to count: a filled-in sheet should become the learner's or team's record of study and completion in the app, and later feed the badge system.

## 2. User journey

1. A teacher opens a lesson and taps **Print the answer sheet**. One A4 page prints.
2. A learner or team writes a **nickname or team name** (no surnames), the team members' first names or nicknames, and the date.
3. While doing the lesson they tick each PRIMM step, answer the numbered questions, fill in the tables, describe what they made and tick the "I can" checks (Yes / Not yet).
4. The teacher or coach checks the sheet, signs it and ticks **Built and working**.
5. *(Part B, M5)* Later, on any device, **each learner** signs in to their own learner profile, enters the **sheet code** printed on the sheet and records what the sheet shows. On a team sheet, every member records it in their own profile: each learner gained the knowledge while working in the team. Progress and badges update.

## 3. Part A: printable answer sheet ✅ built

- **FR-A1** Every lesson has `/lessons/<id>/answer-sheet/`, linked from the lesson page and saved with "Download for offline".
- **FR-A2** The sheet is generated from the lesson text at build time, so it never drifts from the lesson:
  - questions are list items and paragraphs containing "?" in Predict, Run, Investigate and Modify;
  - other list items become numbered "Steps done" tick boxes;
  - tables are copied with their blank answer cells;
  - diagram legends and Teacher notes are left out;
  - Make gets one box: "What we made, how we tested it, and one thing we improved";
  - the "I can" checks come from the lesson's `assessment`.
- **FR-A3** It fits on **one A4 page**. Long sheets automatically use one answer line per question instead of two. An end-to-end test prints every lesson's sheet and fails if any is longer than one page.
- **FR-A4** Each sheet carries a **sheet code**, `<lesson id>-<6 characters>`. The characters are a hash of the questions, so a code always identifies the exact version of the questions a learner answered.
- **FR-A5** Name fields ask only for a nickname or team name and first names or nicknames: no surnames (CLAUDE.md §7).
- All text goes through i18n. Step names follow the lesson's own headings, so a translated lesson gives a translated sheet.

## 4. Part B: recording a sheet in the app (draft, for review)

**Owner decisions (2026-11-23)**
1. **Learners record their own sheets** in their own learner profile.
2. **Team sheets:** each team member records the sheet under their own profile, because each learner gained the knowledge while in the team. There is no shared "team record".
3. **"Not yet" answers do not earn badges.** Badges recognise knowledge gained: only "Yes" answers, completed steps and "Built and working" count.

**Requirements**
- **FR-B1** A learner with a learner profile (M5; created by a teacher or parent, nickname allowed) records a sheet in their own profile.
- **FR-B2** They enter the sheet code. The app shows the same steps and "I can" checks as the paper, and they tick what their sheet shows.
- **FR-B3** Stored per learner and lesson:
  - steps done;
  - "I can" results (yes / not yet);
  - built and working;
  - date;
  - the sheet code;
  - whether it was a team sheet (yes / no; team members are not stored).
- **FR-B4** Written answers are **not** typed in or uploaded. Photos of sheets are not stored.
- **FR-B5** Recording works offline and syncs later (CLAUDE.md non-negotiable 3).
- **FR-B6** Badges (separate spec) read these records, for example "Completed 5 Phase 1 lessons" or "All I-can checks for a lesson". "Not yet" never counts towards a badge; it shows the learner what to work on next.
- **FR-B7** A teacher or coach sees their class's records and can mark a record **checked** (matching the signed paper sheet). Checked records show a tick; whether badges need a checked record is decided in the badges spec.
- **FR-B8** A learner can see and correct only their own records.

**Privacy and child safety (POPIA)**
- Data is minimal: no learner surnames, photos, handwriting, ID numbers or birthdates.
- Records belong to the learner. Only the learner, their class's teachers or coaches, and their parent or guardian can see them.
- Legal basis: parental consent collected at account creation (M5). Records are deleted with the class or on request.
- Threat notes:
  - a learner can write only their own records, and a teacher can only mark records in their own class as checked (row-level security);
  - sheet codes are not secret and grant nothing;
  - there are no free-text fields, so no personal information can be typed into a record by mistake;
  - self-recorded results can be wrong. The teacher's check mark (FR-B7) is the safeguard, and the badges spec decides when it is required.

**Acceptance criteria (Part B, later)**
- A learner records a sheet offline on a phone; it syncs when online; their progress shows the lesson as done.
- Two members of the same team each record the team sheet; each profile shows the lesson as done.
- "Not yet" answers never count towards a badge.
- Entering a sheet code from an older version of a lesson still works and shows that version's steps.
- No free-text answer is stored.

## 5. Tests

- Unit: the sheet parser (questions, steps, tables, legends, Make, density).
- End-to-end: the link from a lesson, the heading, the name fields, the sheet code, and one printed page per lesson.
- People checks (`docs/test-plan.md`): print on a school printer; readable by Grade 3–7 learners; enough space to write.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-23 | Part A built (printable one-page sheets); Part B drafted for review |
| 0.2 | 2026-11-23 | Owner decisions: learners record their own sheets; each team member records the team sheet; "Not yet" earns no badges; teacher check mark |
