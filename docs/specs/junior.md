# Spec: Junior — coding before reading (Grades R–2)

> **Version:** 0.5 · **Date:** 2026-11-28 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-27); editor decided (ADR-0019); CAPS alignment (§2A, FR-9 to FR-16) approved by the owner 2026-11-28
> Depends on: M3 editor (ADR-0005), M4 robot world and robot calls (ADR-0007, ADR-0008), M5 sign-in, records and badges (ADR-0013, ADR-0014, `content/badges`). If approved, CLAUDE.md §1 "Who it's for" changes from Grade 3 to Grade R upward. Brainstorm: build-plan board, "Grades R–2: coding before reading".

## 1. Purpose

Lessons start at Grade 3. Grade R–2 learners (about 5 to 8 years old) can't read blocks yet, but they can plan a route with arrows. **Junior** is a separate tab with **picture blocks** that drive a **floor robot on a grid**, and later the real micro:bit cart. It prepares children for Phase 1 and 2.

**Assumption challenged: why not Scratch?**
- **Licence:** the Scratch editor is moving to AGPL v3, and "Scratch" is a trademark we can't use.
- **Size:** it's a large download, and its media library would have to be hosted on our own site to stay zero-rated.
- **Age fit:** it's made for children who can read.

ScratchJr (ages 5–7) is the right idea, but it's an archived tablet app, not a web app.

Building our own Junior mode reuses Blockly and the M4 robot world, so it adds very little to download, works offline, and needs no reading, which suits every home language.

**Owner decisions (2026-11-27)**
1. The tab is called **Junior**.
2. Grade R–2 learners get **their own sign-in**, with the M5 QR sign-in card and picture PIN: no typing or reading.
3. **Grid robot first.** Stories with characters come later: **owner reminder** to revisit stories after the Junior launch (CLAUDE.md §4).
4. Junior is built **after M6**; the platform's learners start at **Grade R** (CLAUDE.md §1).
5. **A tap-to-add row**, with Blockly sideways as the fallback (ADR-0019): tap a picture to add it, tap a block in the row to take it out; no dragging.
6. **Its own page**, `/code/junior/`, linked as "Junior" from the code editor's tab row.
7. **"×N" repeats the next block** (`[×3][↑]` is forward three times); groups of blocks later if needed.

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

## 2A. CAPS alignment (approved 2026-11-28)

Source: the DBE's *Curriculum and Assessment Policy Statement, Coding and Robotics, Foundation Phase (Grade R–3)* (gazetted 2024), §2.12 (focus of content areas, Tables 2.2–2.4), §3 (content per grade per term) and §4 (assessment). Owner's copy: `CAPS-FP-CODING-AND-ROBOTICS` (project files). Junior covers Grades R–2; Grade 3 is the first grade of the written-block lessons.

### What CAPS asks, and where Junior stands

| CAPS (Table 2.2–2.4, §3) | Grade R | Grade 1 | Grade 2 | Junior today (steps 1–2) | Gap |
|---|---|---|---|---|---|
| **How moves are written (C.2)** | Direction arrows (up, down, left, right); the character turns itself to face the arrow. Terms 1–2: one arrow moves until it hits a barrier or the edge. From Term 3: one square per arrow. Each card is one action; no repeats | Same direction arrows. Repetition introduced (Term 2) as a **number under the arrow**. "Turn around" card (Term 4) | **Turn left / turn right** relative to where the character faces (Term 2); "move forward 1"; jump over a log (2 squares); **IF a coloured tile THEN turn** (Term 4); a limit on cards (e.g. 6 on a 4×4 grid) | Forward, back, turn left, turn right (the Grade 2 model) for every grade; repeat as a separate ×N block before the move | **Big**: Grades R and 1 need direction arrows; Grade R Terms 1–2 need "slide until stop"; repeat should look like the CAPS number under the arrow; Grade 2 needs jump, turn around and IF |
| **Grid size** | Start no larger than 3×3 | Grows | Up to 4×4 in the examples | 3×3 to 6×6 | Keep R–2 missions to 3×3–4×4 (5–6 only as extension) |
| **C.1 develop instructions** | Sequence picture stories; plan a route | + more steps, obstacles, "first the bone, then home" | + coordinates, limits | Build a route from scratch | Ordered goals ("bone, then home"), things to collect (carrots, letters), no-go squares (fire, lava) |
| **C.3 interpret and execute** | Act out given arrows on a grid; one learner instructs, one is the robot | Same, longer | Same | Learners only write programs | **Predict**: watch given code and tap where it ends; **act-out** prompt for pairs |
| **C.4 debug** | Find the wrong arrow and fix it | Same | Errors (more than one) | None | **Fix** missions: a given wrong program |
| **C.5 evaluate** | Act out two routes; which is shortest? | Shorten; group repeats | Reduce steps, group repetition, "better alternative" | Two stars for the fewest blocks | **Choose** (2–3 programs) and **Shorten** (rewrite with repeats) missions |
| **C.6–C.7 patterns** | Identify, recognise, copy, complete a picture pattern (C.7 not in Grade R) | + extend, create | + explain composition, inverse | None | **Pattern** missions (copy, complete, find the error, make your own) |
| **R.6–R.7 mimic and run robot instructions** | Act out instruction cards; build, test, fix with coding cards | Same | Same | Real cart (FR-5), arrow cards, projector | Pair "robot and programmer" mode |
| **D.1–D.9 digital concepts, R.1–R.5 robots** | Talk, draw, build (screen time, personal information, input → output, robot artefacts) | | | Not in the editor | Belongs in the six Grade R–2 **lessons** (step 8), with CAPS codes |

**Problem types** CAPS lists (§3 Grade R Term 4 note and §4.3.1.1), all of which Junior should offer: fill in missing code; choose the correct solution from 2–3; trace or act out code, then debug; rewrite to be more efficient (repeats); compare solutions; turn spoken or written instructions into arrows ("pack the arrow cards", a Parsons puzzle with the cards given); develop the whole solution.

### Assessment (§4)

- In the Foundation Phase all assessment is school-based and continuous. The main techniques are the teacher's observation, oral discussion, practical demonstration and written recording; **Grade R is mainly oral and practical**.
- Observation checklists and rubrics are named as tools. Annexure B gives example rubrics for problem solving (coding), cooperative learning and pair programming, on a 4-level scale summarised to the 7 reporting levels.
- Teachers report against the 7 national achievement levels (percentage bands).

**What this means for Junior**
- Stars stay a game reward on the learner's side. They are **never turned into marks** automatically.
- The teacher records what they observed, per learner and CAPS code, using the M5 records and sign-in (nicknames). Junior gives them an **observation checklist** and printable **rubrics** that follow Annexure B. Any level 1–7 is the teacher's judgement, entered by the teacher.
- Picture sheets (step 2) are the "written recording" for Grades 1–2; Grade R uses the checklist (oral and practical).

### Owner decisions (2026-11-28: all four approved)

1. **Two ways to move, chosen per mission:**
   - **Arrows** (Grades R–1): ↑ → ↓ ←, the character turns itself, plus a Grade R "slide until it stops" version for Terms 1–2.
   - **Turns** (Grade 2, as now): forward, turn left, turn right.

   On the real cart, arrows become a turn to face that way, then a move. *Recommended.*
2. **Repeat as a number under the arrow** (tap it to change 1–5), as CAPS and the arrow cards show it, instead of a separate ×N block. *Recommended*; ×N stays readable in saved programs.
3. **Pattern missions** in Junior (C.6–C.7), not only in lessons. *Recommended*: small, and needs no reading.
4. **Grade 2 IF**: a coloured tile with a "when you land here, turn" card. *Recommended* for Grade 2 Term 4.

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
| FR-9 | Each mission records its **grades, term and CAPS codes** (e.g. `C.1`, `C.3`, `R.6`) and its **kind**; the build rejects unknown codes. Teachers can list missions by grade, term and code to plan their Annual Teaching Plan. |
| FR-10 | **Movement modes** per mission: `arrows` (direction arrows; the character faces the arrow), `arrows-slide` (Grade R Terms 1–2: one arrow moves until a barrier or the edge) and `turns` (forward, back, turn left, turn right, turn around). |
| FR-11 | **Repeat** is a number (1–5) under a move card, matching CAPS; programs saved with the old ×N blocks still open. |
| FR-12 | **Mission kinds:** `build` (from scratch), `complete` (fill the gaps in a given program), `fix` (debug a given wrong program), `predict` (watch a given program, tap the square where it ends), `choose` (pick the program that works, or the shortest, from 2–3), `shorten` (rewrite with fewer cards or repeats), `pattern` (copy, complete, find the error, make your own). |
| FR-13 | **Board features:** things to collect (carrots, letters that spell a word), goals in order ("first the bone, then home"), no-go squares (fire, lava), start or finish outside the grid (enter and leave), a log to **jump** (Grade 2), a coloured **IF tile** with a turn rule (Grade 2 Term 4). |
| FR-14 | **Card limits:** a mission can give an exact set of cards (Parsons puzzle) or a maximum number; the palette shows how many are left. |
| FR-15 | **Teacher tools:** a mission list by grade, term and CAPS code; a printable **observation checklist** per class (nicknames, CAPS codes, "seen / not yet"); printable **rubrics** following CAPS Annexure B (problem solving, pair programming, cooperative learning); the teacher records observations against each learner in the M5 records, offline-first. No automatic marks. |
| FR-16 | **Pairs mode** on the big screen: "one is the robot, one is the programmer", with a prompt to swap roles after each run (CAPS §3 R.6, §4.3.3 pair programming). |

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
- [ ] Every mission has grades, term, CAPS codes and kind; the build rejects an unknown code (unit test).
- [ ] A Grade R "slide" mission and a Grade 1 arrows mission run exactly as CAPS describes; arrows convert to the same robot calls as turns (unit tests).
- [ ] One mission of each kind (complete, fix, predict, choose, shorten, pattern) can be solved on a 360 px phone without reading (e2e).
- [ ] The observation checklist and rubrics print on A4 and use nicknames only (e2e; printing in the test plan).

## 9. Work plan

After M6, unless the owner moves it earlier.

1. *(built 2026-11-27, ADR-0019)*
   - The grid engine: `packages/sim/src/junior.ts`, pure TypeScript, also used by the build check. It handles ×N repeats, bumps into rocks and the edge, and stars (one for reaching the target, two for the fewest blocks). It also turns a program into robot calls for the real cart: 150 mm squares, 90° turns.
   - Missions are data in `content/junior/` (not `content/worlds`, whose M4 format is for continuous worlds), with an order file. The build fails if a mission can't be solved in its "best".
   - Three missions, for Grades R, 1 and 2: Bee to the flower (2 blocks), Rhino to the water (5), Bus to school (8).
   - The page `/code/junior/`: tap-to-add row; Undo and Clear; Play with the current block lit; beep and light; Say the block names (speech synthesis where the phone has a voice). Stars are kept on the phone for now. Recording missions with the learner's sign-in (FR-7) and sending to the real cart (FR-5) come with steps 2 and 3.
   - Pictures are inline SVG with no words. The page is 34.6 KB compressed in all (CI checks 40 KB). It works offline after a visit.
   - Tests: e2e at 360 px, offline and accessibility.

   **Junior blocks + grid mode + three missions.**
2. *(built 2026-11-28)*
   - **Big screen** (FR-8): a button on Junior. On a wide screen the board sits beside the blocks, everything gets bigger, and the page goes full screen where the browser allows it.
   - **Arrow cards** (FR-6) at `/code/junior/cards/`: two A4 pages of 6.2 cm cut-out cards in the block colours (start, forward, back, turn left, turn right, ×2–×5), with no words.
   - **A picture mission sheet** for each mission at `/code/junior/sheet/<mission>/`: one A4 page with the board, empty boxes to draw the arrows in, three faces and two stars to colour. The mission's name is the only word, for the adult.
   - Junior links to the cards and to each mission's sheet.
   - Tests: e2e checks the page counts (2 and 1), the projector size and accessibility. Printing on real paper goes in the test plan (B60).

   **Projector layout, arrow cards, picture answer sheet.**
CAPS alignment approved by the owner (2026-11-28). Then:

3. *(built 2026-11-28)* **Arrows and CAPS tags:** movement modes (FR-10), repeat number under the card (FR-11), turn around; mission grades, term and CAPS codes (FR-9); the three missions retagged (bee: Grade R arrows-slide; rhino: Grade 1 arrows; bus: Grade 2 turns); arrow cards and sheets drawn the CAPS way.
4. **Mission kinds** (FR-12) and **card limits** (FR-14): complete, fix, predict, choose, shorten; 12 missions across Grade R Terms 1–4, Grade 1 and Grade 2, each tagged.
5. **Grade 2 board features** (FR-13): collect, ordered goals, no-go squares, enter and leave, jump, IF tile; 4 more missions.
6. **Patterns** (FR-12 `pattern`): copy, complete, find the error, make your own; 4 missions.
7. **Teacher tools** (FR-15, FR-16): mission planner by CAPS code, observation checklist and Annexure B rubrics to print, observations recorded with M5; pairs mode.
8. Six Grade R–2 lessons (two per grade) for R.1–R.5 and D.1–D.9, with CAPS codes. ⏸ owner review.

## 10. AI · 11. Revenue · 12. Risks · 13. Owner actions

- **AI:** back office drafts new missions and matching arrow-card lessons; always human-reviewed.
- **Revenue:** core stays free. Optional printed arrow-card packs and floor grid mats as kit items.
- **Risks:**
  - Real carts don't move exactly one square, so missions on the floor drift. Calibration per profile, and lessons treat it as a "test and improve" moment.
  - Grade R attention spans are short: missions take 2–5 minutes each.
- **Owner actions:** none open; stories to be revisited after launch (reminder).

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-27 | First draft from the build-plan board brainstorm |
| 0.2 | 2026-11-27 | Approved: tab named Junior, own sign-in with the QR card, grid first, stories later (reminder), after M6 |
| 0.3 | 2026-11-27 | Owner decisions: tap-to-add row with Blockly as fallback (ADR-0019), own page linked as a tab, ×N repeats the next block; step 1 built |
| 0.4 | 2026-11-28 | Draft §2A CAPS alignment against the Foundation Phase CAPS (§2.12, §3, §4): direction arrows for Grades R–1, repeat under the arrow, mission kinds, board features, CAPS tags, teacher observation and rubrics (FR-9 to FR-16); work plan steps 3–8 |
| 0.5 | 2026-11-28 | CAPS alignment approved (all four decisions); step 3 built: direction arrows and Grade R slide, repeat number under the card, turn around, missions tagged with grades, term and CAPS codes |
