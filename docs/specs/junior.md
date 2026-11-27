# Spec: Junior — coding before reading (Grades R–2)

> **Version:** 0.1 (draft) · **Date:** 2026-11-27 · **Owner:** Rashid Ishmail · **Status:** Draft, for review
> Depends on: M3 editor (ADR-0005), M4 robot world and robot calls (ADR-0007, ADR-0008), M5 sign-in, records and badges (ADR-0013, ADR-0014, `content/badges`). If approved, CLAUDE.md §1 "Who it's for" changes from Grade 3 to Grade R upward. Brainstorm: build-plan board, "Grades R–2: coding before reading".

## 1. Purpose

Lessons start at Grade 3. Grade R–2 learners (about 5 to 8 years old) can't read blocks yet, but they can plan a route with arrows. **Junior** is a separate tab with **picture blocks** that drive a **floor robot on a grid**, and later the real micro:bit cart. It prepares children for Phase 1 and 2.

**Assumption challenged: why not Scratch?**
- **Licence:** the Scratch editor is moving to AGPL v3, and "Scratch" is a trademark we can't use.
- **Size:** it's a large download, and its media library would have to be hosted on our own site to stay zero-rated.
- **Age fit:** it's made for children who can read.

ScratchJr (ages 5–7) is the right idea, but it's an archived tablet app, not a web app.

Building our own Junior mode reuses Blockly and the M4 robot world, so it adds very little to download, works offline, and needs no reading, which suits every home language.

## 2. Scope

**In scope**
- **Junior tab** in the code editor, beside the on-screen micro:bit and Robot tabs.
- **Picture blocks**, read and joined left to right, with no words on them:
  - start (green flag);
  - forward 1, back 1, turn left, turn right;
  - repeat ×2–×5;
  - wait;
  - sound (beep, tune);
  - light (show a picture on the micro:bit);
  - stop.
- **Grid world:** the robot moves one square per step; 3×3 to 6×6 boards with a start square, a target and simple obstacles. Missions are defined as data (`content/worlds`, M4 format, with a `grid` option).
- **Same robot calls** (ADR-0008): one square = a move of a fixed length (15 cm, like classroom floor robots), so a Junior program drives the real cart through its robot profile.
- **Grade R–2 lessons** in the usual lesson format (PRIMM simplified to Predict–Run–Try–Make), with printable **unplugged arrow cards** and a **picture answer sheet** (smiley faces instead of words).
- **Projector mode:** large blocks and grid for whole-class work; the class predicts, then children take turns.

**Out of scope (later)**
- Characters and story scenes (ScratchJr-style).
- Drawing tools.
- Sound recording (privacy and storage).
- Learner-shared projects (they need moderation).

## 3. Journeys

- **Grade R teacher, one phone and a projector:**
  1. Opens the Junior lesson "Get the rhino to the water" and shows the grid.
  2. Children hold up arrow cards to plan the route.
  3. One child taps in the blocks and runs them.
  4. The class checks the prediction.
- **Grade 2 learner at home:**
  1. Signs in with the M5 QR card and picture PIN.
  2. Solves three grid missions; a star shows each one done.
  3. Their progress shows in their parent's view.
- **Club with a micro:bit cart:** after solving a mission on screen, the club lays a masking-tape grid on the floor and sends the same program to the real cart.

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Junior blocks have icons only, plus a spoken name and a screen-reader label through i18n. Touch targets are at least 48 × 48 px. |
| FR-2 | Blocks snap horizontally into one row, which wraps on small screens; at most 20 blocks per program at launch. |
| FR-3 | Programs run in the M4 robot world in grid mode: one step per block, slow and visible, with the current block lit up. |
| FR-4 | Missions are data: grid size, start, target, obstacles, the blocks allowed, and the fewest blocks needed (for a "best solution" star). The build checks each mission can be solved. |
| FR-5 | The same program can be sent to a real micro:bit cart through the robot profile (ADR-0008), with a calibrated square length. |
| FR-6 | Printable resources come from the same data: arrow cards (A4, cut out) and a picture answer sheet per lesson. |
| FR-7 | Progress (missions done, stars) is stored like other lesson progress (M5, ADR-0014) and works offline. |
| FR-8 | Junior has a projector layout: a large grid, blocks and run button. |

## 5. Non-functional requirements

- Adds **under 40 KB** compressed (icons as inline SVG, no new dependency).
- Works on a 360 px phone, offline after the first visit.
- WCAG 2.2 AA:
  - the light-up highlight and the icons pass contrast;
  - every block can be used with the keyboard, and the screen reader announces moves.
- No text to translate except spoken names and labels.

## 6. Technical architecture

- **Blocks:** a second, small Blockly block set in `packages/blocks` (horizontal layout, icon fields). It generates the same robot calls as the Grade 3+ blocks, so there is one runtime.
- **Grid mode** in `packages/sim`: positions snap to squares, turns are 90°, and a block per step drives the animation.
- **Lessons:** front matter gains `junior: true` and `world: <id>`; grades accept `R` (as 0), 1 and 2.
- An ADR is needed only if Blockly's horizontal layout turns out not to work on phones; the fallback is a tiny custom row editor of about 300 lines.

## 7. Security, privacy and child safety

- No new personal data: the M5 learner profile and sign-in (QR card plus picture PIN) are reused.
- No microphone, camera or free text.
- The youngest learners only use a device with an adult present; lessons say so.

## 8. Acceptance criteria

- [ ] A 4×4 mission is solved with picture blocks on a 360 px phone, without reading (e2e).
- [ ] A program with repeat moves the robot exactly the planned squares and turns (unit test).
- [ ] The same program runs on the real cart through a robot profile (test plan, real device).
- [ ] Arrow cards and the picture answer sheet print on A4 (e2e page count; people check in test plan).
- [ ] Junior adds < 40 KB compressed; works offline (e2e).

## 9. Work plan

After M6, unless the owner moves it earlier.

1. Junior blocks + grid mode + three missions (after M4 steps that build the robot world UI).
2. Projector layout, arrow cards, picture answer sheet.
3. Six Grade R–2 lessons (two per grade), CAPS Foundation Phase links to confirm. ⏸ owner review.

## 10. AI · 11. Revenue · 12. Risks · 13. Owner actions

- **AI:** back office drafts new missions and matching arrow-card lessons; always human-reviewed.
- **Revenue:** core stays free. Optional printed arrow-card packs and floor grid mats as kit items.
- **Risks:**
  - Real carts don't move exactly one square, so missions on the floor drift. Calibration per profile, and lessons treat it as a "test and improve" moment.
  - Grade R attention spans are short: missions take 2–5 minutes each.
- **Owner actions:** approve this spec, and answer the open questions on the board:
  - the tab's name;
  - own sign-in for Grade R–2 (guess: yes, with the QR card);
  - grid only, or stories too.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-27 | First draft from the build-plan board brainstorm |
