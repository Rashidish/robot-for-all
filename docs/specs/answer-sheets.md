# Spec: Answer sheets and lesson progress records

> **Version:** 0.1 · **Date:** 2026-11-23 · **Owner:** Rashid Ishmail · **Status:** Part A built; Part B draft for review
> Depends on: M2 lesson format (ADR-0004), CLAUDE.md §7 (POPIA). Part B needs M5 (accounts and classes).

---

## 1. Purpose

Many classes work from printed lessons with one shared phone or none. Learners need a paper place to answer the lesson's questions, and teachers need that paper to count: a filled-in sheet should become the learner's or team's record of study and completion in the app, and later feed the badge system.

## 2. User journey

1. A teacher opens a lesson and taps **Print the answer sheet**. One A4 page prints.
2. A learner or team writes a **nickname or team name** (no surnames), the team members' first names or nicknames, and the date.
3. While doing the lesson they tick each PRIMM step, answer the numbered questions, fill in the tables, describe what they made and tick the "I can" checks (Yes / Not yet).
4. The teacher or coach checks the sheet, signs it and ticks **Built and working**.
5. *(Part B, M5)* Later, on any device, the teacher opens their class, picks the learner or team, enters the **sheet code** printed on the sheet and records what was done. Progress and badges update.

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

**Requirements (proposed)**
- **FR-B1** A teacher, coach or parent with an account (M5) records a sheet for a learner (nickname) or a **team** (team name plus member nicknames) in their own class.
- **FR-B2** They enter the sheet code. The app shows the same steps and "I can" checks as the paper, and they tick what the sheet shows.
- **FR-B3** Stored per learner or team and lesson:
  - steps done;
  - "I can" results (yes / not yet);
  - built and working;
  - date;
  - who recorded it;
  - the sheet code.
- **FR-B4** Written answers are **not** typed in or uploaded. Photos of sheets are not stored.
- **FR-B5** Recording works offline and syncs later (CLAUDE.md non-negotiable 3).
- **FR-B6** Badges (separate spec) read these records, for example "Completed 5 Phase 1 lessons" or "All I-can checks for a lesson".
- **FR-B7** A team record counts for each member of the team.

**Privacy and child safety (POPIA)**
- Data is minimal: no learner surnames, photos, handwriting, ID numbers or birthdates.
- Records belong to the class and are visible only to that class's teachers or coaches and to the learner's parent or guardian.
- Legal basis: parental consent collected at account creation (M5). Records are deleted with the class or on request.
- Threat notes: only the class owner can write records (row-level security); sheet codes are not secret and grant nothing; no free-text fields, so no personal information can be typed into a record by mistake.

**Open questions for the owner**
1. Should learners (not only adults) record their own sheets?
2. Should "Not yet" answers count towards badges for effort?
3. Should team records count fully for every member?

**Acceptance criteria (Part B, later)**
- A teacher records a sheet offline on a phone; it syncs when online; the learner's progress shows the lesson as done.
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
