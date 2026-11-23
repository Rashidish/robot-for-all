# Spec: M4 — Simulate (2D robot and sensor world)

> **Version:** 0.5 · **Date:** 2026-11-23 · **Owner:** Rashid Ishmail · **Status:** Draft — v0.5 changes wait for owner review (v0.4 approved 2026-11-23)
> Depends on: M3 (block editor, on-screen micro:bit, ADR-0006), ADR-0007 (engine reuse), **ADR-0008 (robot profiles)**, M2 (cardboard templates), CLAUDE.md 0.14. Feeds: the submission kit (submissions-spec v0.3, FR-S3 "runs ✔" check), M5 challenge records and virtual competitions.

## 1. Purpose

Most learners will never own a motor driver, let alone a robot. M4 lets every learner drive a **robot on screen**: the cart from Phase 1 with the micro:bit from Phase 2. They drive it with the same blocks and the same program they would send to a real robot — whatever motor driver board that robot has (ADR-0008) — in challenges such as "stop in the tunnel", "follow the line" and "get through the maze".

**v0.5 follows ADR-0008:** programs name robot parts ("left motor", "left whisker", "pen"), never pins. The robot world answers those **robot calls**; on a real robot, a robot profile turns them into that board's signals. No fixed pin numbers remain in this spec except in the wiring examples for the recommended cheapest build.

**v0.4 added Courses & Seasons (§14):** every course is defined once, as data, and runs in two places — **on screen** in the simulator and **on the floor** as printable A4 tiles with tape lines and cardboard walls. Same course, same program, on screen or on the floor.

**Assumption challenged (ADR-0007).** CLAUDE.md §5 planned a separate simulator: Canvas 2D plus a physics library, running block code itself. A cheaper and more faithful design is to **reuse the on-screen micro:bit**. It already runs real MicroPython (ADR-0006). The robot world only has to:
- turn robot calls (left and right motor speed, pen up/down) into wheel speeds and pen strokes;
- answer sensor calls (line sensors, whiskers) and feed the micro:bit's own sensors (light level, bump as a shake).

(ADR-0007 linked the world to motor *pins*; ADR-0008 replaces that link with robot calls, §6.2.)

This means:
- one engine runs everything, so behaviour on screen matches the real robot;
- there is no second interpreter;
- typed Python works too;
- there is no physics library: a two-wheel robot needs about 50 lines of maths.

## 2. Scope

**In scope**
- A 2D top-down **robot world** beside the on-screen micro:bit in the code editor (a "Robot" tab next to the micro:bit).
- One robot: two-wheel cart, **left motor** and **right motor**; a one-motor robot (the one-motor cart from the Phase 2 lessons) drives both wheels from the left motor. The on-screen robot behaves the same whichever robot profile the learner picked (ADR-0008).
- Sensors:
  - **light level**: brightness of the floor or tunnel under the robot;
  - **two line sensors**, left and right ("line under left sensor?": yes = dark line), like low-cost IR line-sensor boards;
  - **two whisker bumpers** (v0.4), left and right ("left whisker pressed?"), the cardboard paper-clip-and-foil switch (§14.3);
  - **bump**: hitting a wall gives a "shake" gesture and stops the wheels (kept for robots without whiskers).
- **Pen** (v0.3): a servo lifts or lowers a pen ("pen down", "pen up"); pen down draws on the floor (§13.3).
- **Monitor, grid and location readout** (v0.3, §13.2).
- **Worlds as data** (JSON, like lessons): size, floor (lines, dark areas, grid), walls, start position, goal area, and the challenge text through i18n. Seven worlds at launch:
  1. open floor;
  2. dark tunnel (Robot that reacts);
  3. drive to the box and back (Forward, stop, reverse);
  4. follow the line;
  5. simple maze with bumps;
  6. **grid map** (v0.3): squares of 200 mm, "drive to C4", maths link;
  7. **art floor** (v0.3): draw a square, a triangle, your initial.
- **Courses** (v0.4, §14): worlds with a cell grid, cardboard wall pieces, missions and scoring, printable as A4 tiles with a wall build sheet; **seeded random mazes** (walls or lines).
- **Seasons** (v0.4, §14.6): a yearly themed course set; Season 1 "Rhino Patrol".
- **Challenge check:** reaching the goal (and any rule such as "stop inside the tunnel") shows "Challenge done" with the time. No account needed: the result is kept on the device as a **run report** (§6.1). M5 records it later like an answer sheet, and the submission kit attaches it as the "runs ✔" check.
- Lessons can open a world: front matter `world: <id>` next to `starter_program`.

**Out of scope (later)**
- 3D (see §13.1 for why).
- Building your own robot shape.
- Distance (ultrasonic) sensor: needs an extension and the extension format review (owner reminder).
- Objects that move freely when pushed (VEX "electromagnet", LEGO mission models that slide): needs physics. v0.4 missions use fixed targets and flaps only (§14.4).
- Multi-robot competitions on the same course at the same time (Later milestone); v0.4 competitions are one robot per run, ranked by headless replay.
- Learner-made worlds and courses (needs moderation, CLAUDE.md §7).

## 3. Users and journeys

**Learner without hardware (Grade 6).** Opens "Robot that reacts" and taps Open in code editor. Taps the **Robot** tab: the tunnel world. Runs the program and watches the cart drive into the tunnel and stop. "Challenge done". Then modifies the light threshold, as the lesson asks, watching the light level on the **Monitor** graph drop as the cart enters the tunnel.

**Learner with a real robot.** Sets up **My robot** once (ADR-0008: auto-detect, or pick their board), wires the sensors as the wiring diagram for that board shows, tests in the world first, then sends the same program to the real cart. They compare and explain the differences (friction, battery, light in the room). This is a CAPS "test and improve" moment.

**Teacher with one projector.** Shows the world on the projector; groups predict where the robot will stop before it runs (PRIMM Predict). On the grid world, groups predict the final square and check it with the location readout.

**Learner making art (Grade 4–5).** Opens the art floor, lowers the pen, and repeats "forward, turn 90°" four times. The square comes out slightly crooked with "real floor" on: a conversation about why real robots drift.

**Club building a floor course (v0.4, Grade 5).** The coach opens "Bump maze 4×4", taps **Print course**: 15 A4 tiles plus a wall build sheet. Learners tape the tiles together, check the 100 mm calibration square with a ruler, cut wall pieces from cereal boxes using the wall template, and place them as the build sheet shows. They build the whisker bumper (lesson `p2-whisker-01`), test "bump, back up, turn" on screen, then on the floor.

**School competition day (v0.4, Grade 7–9).** The organiser reveals maze number 4817 at the start. Every team prints or opens the same maze; nobody has seen it before, so programs must sense rather than remember moves. Teams submit programs; the server re-runs each one on maze 4817 and ranks them by its own run report. A human checks the top places (assessment decision).

**Learner handing in work (submission kit).** After "Challenge done", **Submit** in the code editor attaches the program, its version history and the run report ("runs ✔ · dark tunnel · 6.4 s · 0 bumps").

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | A Robot tab in the code editor shows a world and the robot; Run, Stop and Restart drive both the micro:bit and the robot. |
| FR-2 | Motor calls become wheel speeds: forward/backward and speed (0–100 %) for the left and right motor; differential drive turns the robot. |
| FR-3 | The light level under the robot is sent to the micro:bit about 10 times a second; line-sensor calls answer from the floor under each sensor; a wall bump sends "shake" and stops the robot at the wall. |
| FR-4 | Worlds are JSON files in `content/worlds/<id>.json`, checked at build; the build fails on an invalid world, with the path to each problem. Teachers can add a world without touching code. |
| FR-5 | Each world has a challenge: goal area, optional rules (stop inside an area, time limit, no bumps) and a "Challenge done" message with the time. |
| FR-6 | Zoom to fit a 360 px screen; the robot's trail can be shown or hidden; speed ×1 / ×2. |
| FR-7 | Keyboard and screen reader: the robot's position, heading, sensor values and challenge state are announced on request and when they change. |
| FR-8 | Lessons: `world: <id>` in front matter opens that world with the starter program. |
| FR-9 | Works offline after first use, like the editor. |
| FR-10 | Every run can produce a **run report** (§6.1) for the submission kit and challenge records. |
| FR-11 | **Monitor** (v0.3): a collapsible panel lists live values — left/right motor speed, light level, left/right line sensor, left/right whisker, last gesture, pen up/down — and draws one line graph of a chosen value over the last 10 s. |
| FR-12 | **Grid and location** (v0.3): a grid overlay (on/off) with lettered columns and numbered rows; a readout of x, y (mm) and heading (°) and the current square (e.g. "C4"). |
| FR-13 | **Pen** (v0.3): "pen down" and "pen up" calls lower and lift the pen (on a real robot, the profile's pen servo: ≤ 45° down, above up); pen down draws the path in the world's pen colour. The drawing can be cleared and saved as a small PNG for the submission kit. |
| FR-14 | **Headless replay** (v0.3): `packages/sim` can re-run a program against a world with no screen and produce the same run report, byte for byte, for a given seed. |
| FR-15 | **Whiskers** (v0.4): when the front-left or front-right of the robot touches a wall or target, "left whisker pressed?" or "right whisker pressed?" answers yes until contact ends. A world sets `bump: "whiskers"` (robot stops against the wall, no shake) or `bump: "shake"` (v0.2 behaviour). |
| FR-16 | **Course layers** (v0.4): a course has a cell grid (200 mm cells), an optional **line layer** (tape lines), an optional **wall layer** (standard cardboard pieces on cell edges), and **missions**. Either layer alone, or both together, is a valid course. |
| FR-17 | **Missions and scoring** (v0.4): mission types — reach zone, stop in zone, visit checkpoints in order, touch target (whisker on a target piece), pass under tunnel, return home. Each has points; the course adds an optional time bonus and a penalty per wall touch. The run report carries the score and each mission's result. |
| FR-18 | **Seeded random mazes** (v0.4): a maze number (seed) and size (3×3 to 6×6 cells) give one exact maze, as walls or as tape lines; always solvable, start and finish fixed; the same number gives the same maze on every device. |
| FR-19 | **Print course** (v0.4): any course or maze prints as A4 tiles at 1:1 scale, with tile numbers, alignment marks, a 100 mm calibration square, an assembly map, and — when there are walls — a **build sheet** listing every wall piece and where it goes. Printing uses the browser's print (SVG pages), works offline, and needs no PDF library. |
| FR-20 | **Seasons** (v0.4): a season is a named, themed set of courses with its own missions and artwork, active for a date range; past seasons stay playable. |
| FR-21 | **Robot calls** (v0.5, ADR-0008): `packages/sim` takes robot calls (motor speed per side, pen) and answers sensor calls (line sensors, whiskers); it never reads or sets pin numbers. The same program gives the same run report whichever robot profile is selected. |

## 5. Non-functional requirements

- **Size:** the robot world adds **under 30 KB** compressed to the code page, with no new dependency. Monitor, grid and pen are budgeted at about 6 KB of that; whiskers, missions and the maze generator about 4 KB. **Print course** is a separate chunk (≤ 10 KB) loaded only when the learner taps Print. Worlds and courses are a few KB each.
- **Speed:** 30 frames per second on a low-end Android phone. The simulation runs at fixed 20 ms steps, so results don't depend on the phone's speed; one call moves at most 1 s, so the robot doesn't jump after a phone wakes from sleep. The Monitor graph redraws at most 5 times a second. The maze generator makes a 6×6 maze in under 5 ms.
- **Accessibility:** WCAG 2.2 AA. Colours of floor, lines and robot pass contrast; patterns (hatch, dots, checks) as well as colour mark areas. The Monitor is also a plain table for screen readers. Printed tiles are black on white with patterned zones, so they work on black-and-white printers.
- **Print cost:** a 4×4 course prints on about 15 A4 pages, mostly white (low ink); zones use hatching, not solid fills.
- **i18n:** all text, including world challenges (`world_*` keys), mission names, grid labels and the build sheet.

## 6. Technical architecture

```
Blocks / typed Python ──► rfa_robot calls ──► on-screen micro:bit (MicroPython, iframe)
                               │ robot calls (motor L/R, pen)   ▲ sensor answers (line L/R, whisker L/R); lightLevel, gesture
                               ▼                                │
                        packages/sim: robot world (TypeScript)
                          - world.ts:   world/course format, checks, floor brightness, grid, fingerprint
                          - robot.ts:   motor calls → wheel speeds; pen calls → pen; whisker geometry
                          - sim.ts:     fixed 20 ms steps, sensors, walls, missions, scoring, pen strokes, run report
                          - maze.ts:    seeded maze generator (walls or lines) (v0.4)
                          - replay.ts:  headless re-run for verification (v0.3)
                        apps/web: Robot tab (Svelte + canvas) + Monitor — step 2
                        apps/web: Print course (SVG pages, on demand) — step 2b (v0.4)
```

- `packages/sim`: pure TypeScript, no DOM, no dependencies, fully unit-tested.
- Kinematics: `v = (vL + vR) / 2`, turn rate `(vL − vR) / track` (screen coordinates, y down, heading clockwise from east). Cart: 0.1 m between the wheels, 0.06 m radius for bumps, 0.2 m/s at 100 %.
- Whiskers: two contact points 0.07 m ahead of the axle, ±0.04 m to each side; a whisker reads 1 while its point is inside a wall or target.
- "Real floor" option: each wheel gets a seeded difference of up to ±3 %, so learners see why a real robot drifts; seeded, so a run repeats exactly.
- Maze generator: a small seeded random number generator (e.g. mulberry32) and a depth-first "perfect maze" (exactly one path between any two cells). Line mazes draw lines along cell centres between connected cells; wall mazes place a wall piece on every closed cell edge.
- Robot calls reach the world as described in §6.2; no pin numbers cross the boundary between the on-screen micro:bit and `packages/sim`.
- Pen strokes are stored as a list of line segments (not pixels), so they are tiny, redraw at any zoom, and the PNG is made only on Submit.

### 6.1 Run report

```json
{ "sim": "rfa-sim/1", "worldId": "rhino-patrol-1", "worldVersion": 1, "worldHash": "1a2b3c4d",
  "programHash": "…", "status": "done", "timeMs": 48200, "bumps": 2, "distance": 3.4,
  "realFloor": false, "seed": 4817,
  "score": 145, "missions": { "gate": 1, "waterhole": 1, "home": 0 } }
```

- About 300 bytes. No personal data.
- `worldHash` and `programHash` say exactly which world and program produced the result, so a stored result can't be confused with a later version (submission kit: evidence locking and hashing).
- `status` is `done`, `failed` (with `reason`: `timeLimit` or `bumped`) or `running` (stopped by the learner).
- `seed` (v0.3) makes "real floor" runs and random mazes replayable (FR-14, FR-18).
- `score` and `missions` (v0.4) appear only for courses with missions.
- No robot profile in the report (v0.5): the world behaves the same for every profile (FR-21), so the result doesn't depend on it.

### 6.2 Robot calls and profiles (v0.5, ADR-0008)

| Call (blocks / `rfa_robot`) | On screen (`packages/sim`) | On a real robot (profile) |
|---|---|---|
| left / right motor forward/backward at n % | wheel speed for that side | pins + PWM, or I2C chip channel |
| stop motors | both wheels 0 | as above |
| pen down / pen up | pen on / off | servo on a free pin: ≤ 45° / 90° |
| line under left / right sensor? | floor darkness under that sensor | digital read on a free pin |
| left / right whisker pressed? | whisker contact point inside a wall or target | digital read on a free pin |
| light level, shake | micro:bit's own sensors (unchanged) | micro:bit's own sensors |

- **Proposed:** in the on-screen micro:bit, `rfa_robot` uses a built-in **simulator profile** that sends robot calls to the world and reads sensor answers back, through one small simulator patch (like the M3 pin-output patch). The real-robot profiles are the ADR-0008 data files. Confirm in step 1c.
- `packages/sim` gets the same interface for headless replay: a scripted driver or the replayed program calls `setMotor(side, speed)`, `setPen(down)`, `line(side)`, `whisker(side)` — so tests never name pins.
- One-motor profiles: "right motor" calls are ignored and both wheels follow the left motor (§2).
- "Test my robot" fixes (flip a motor, swap motors) live in the learner's profile settings on the device and never reach the simulator.

## 7. Security, privacy and child safety

- No personal data; run reports and pen drawings stay on the device until the submission kit or M5 uploads them.
- Worlds, courses and seasons are build-time content reviewed like lessons; no user uploads in M4.
- Threat notes: messages between the world and the iframe are checked for origin and shape, as in M3.
- A run report made on the learner's device can be edited. For anything that counts (formal assessment, competitions), the server re-runs the program with headless replay and trusts only its own report (§13.5). Competition maze numbers are kept secret until the start.
- Physical safety (lesson notes): scissors and craft knives with adult supervision for younger grades; paper clips bent with pliers; no mains power anywhere in the build.

## 8. Acceptance criteria

- [x] Forward at 100 % for 1 s moves the robot the expected distance ± 5 % (unit test).
- [x] Two motors at different speeds turn the robot the right way (unit test).
- [x] The "Robot that reacts" logic stops the robot inside the tunnel world; a two-sensor line follower finishes the line world; the box-and-back and maze worlds can be finished (unit tests with scripted drivers).
- [x] Bumping a wall gives a shake and stops the robot at the wall (unit test).
- [x] A world with a mistake is rejected with the path to each problem (unit test); build-time check in step 3.
- [ ] "Robot that reacts" starter program on the on-screen micro:bit stops the robot inside the tunnel world (e2e, step 2).
- [ ] A line-follow program written with the left/right line-sensor blocks finishes the line world (e2e, step 4).
- [ ] The robot world adds < 30 KB compressed; Lighthouse 90+ on `/code/`; works offline (e2e, step 2).
- [ ] (v0.3) "Pen down" draws, "pen up" doesn't; four "forward + turn 90°" draw a closed square within 2 % on a plain floor (unit test).
- [ ] (v0.3) Grid readout names the right square at each corner and the centre of the grid world (unit test).
- [ ] (v0.3) Headless replay of a scripted driver gives a byte-identical run report on two runs, with and without "real floor" (unit test).
- [ ] (v0.3) Monitor shows light level falling as the robot enters the tunnel; the screen-reader table matches (e2e, step 2).
- [ ] (v0.4) Driving straight into a wall makes the facing whisker report pressed and the other not; driving at an angle sets only the near one (unit test).
- [ ] (v0.4) The same maze number and size give identical mazes on two runs; 1,000 random mazes are all solvable from start to finish (unit test).
- [ ] (v0.4) A "bump, back up, turn right" driver escapes every 4×4 wall maze in a sample of 100 within the time limit, or the course's time limit is raised to fit (unit test sets the default).
- [ ] (v0.4) A left-hand line-maze driver with two line sensors finishes 100 sample 4×4 line mazes (unit test).
- [ ] (v0.4) Mission scoring: a scripted run that completes two of three missions gets exactly their points, the time bonus and the wall-touch penalties (unit test).
- [ ] (v0.4) Printed tiles at 100 % give a calibration square of 100 mm ± 1 mm on two different printers; tiles join with marks aligned (manual test, test plan).
- [ ] (v0.4) The build sheet lists the same number of wall pieces as the on-screen maze (unit test).
- [ ] (v0.5) `packages/sim` has no pin numbers in its public interface; the scripted drivers and replay use robot calls only (unit test / type check).
- [ ] (v0.5) The same program gives a byte-identical run report with two different robot profiles selected (unit test).

## 9. Work plan for Claude Code

1. ~~**ADR-0007 + `packages/sim` core**~~ ✅ Done: world format and checks, kinematics, sensors, walls, rules, run report; five launch worlds with English challenge texts; unit tests.
1b. **(v0.3) `packages/sim` additions** — no UI, so not blocked by the rename: pen (pen calls → strokes; was P16 servo in v0.3), grid in the world format and square lookup, `seed` in the run report, `replay.ts`; grid-map and art-floor worlds; unit tests.
1c. **(v0.4, changed v0.5) Robot calls and courses in `packages/sim`** — no UI: switch the engine from pins to robot calls (ADR-0008 rollout 1, §6.2) first; then whiskers and the `bump` setting, course layers and wall pieces, missions and scoring, `maze.ts`, score in the run report; first courses (§14.5); unit tests.
2. **Robot tab**: canvas view, link to the on-screen micro:bit through robot calls (simulator profile), controls, Monitor, grid overlay, location readout, pen drawing, mission checklist, maze number entry, accessibility. ⏸ Before this UI step: the repo rename to `robots-for-all` and the domain (owner reminder).
2b. **(v0.4) Print course**: A4 tile pages, alignment marks, calibration square, assembly map, wall build sheet; loaded on demand.
3. **Worlds and courses in the build** + `world:` in lesson front matter; the Phase 2 lessons point to their worlds.
4. **Lessons and templates** (with M2): line-follow lesson `p2-line-01`, pen-art lesson `p2-art-01`, **whisker bumper lesson `p2-whisker-01`**, **bump maze lesson `p2-maze-01`**, **line maze lesson `p3-linemaze-01`**; cardboard templates for the wall piece, tunnel, target/gate flap and whisker bumper; test-plan rows. ⏸ owner review of worlds, courses and lessons.
5. **(v0.4) Season 1 "Rhino Patrol"**: three courses (one per grade band), artwork in the Lite UI and CI, mission texts. ⏸ owner review; sponsor or NGO partner optional.

## 10. AI opportunities

The M6 helper explains why a robot didn't finish a challenge, using the program, the run report and the Monitor trace (no personal data). In the back office, AI drafts new worlds, courses and season missions from a description, always human-reviewed. AI also drafts the build-sheet instructions and cardboard templates for new course pieces (back-office CAD, as for other templates).

## 11. Revenue notes

Free at the core — including everything VEX sells in its paid VR tiers that we can do in 2D (Python, more worlds, sensor monitor), and every course and maze. Later: sponsored seasons and challenge worlds (e.g. "Rhino Patrol" with a conservation NGO partner), pre-printed vinyl course mats and wall kits sold through the platform's kit ordering, and school competition packs verified by headless replay.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Pin messages arrive too slowly for smooth driving | Jerky robot | The world integrates at fixed steps using the latest pin state; the messages only change state |
| Learners expect the real robot to behave exactly like the screen | Frustration | Lessons say why they differ; "real floor" option with small seeded wheel differences |
| Low-end phones struggle with the iframe plus the canvas | Slow | Draw only what changed; ×1 speed default; Monitor graph throttled; measured on a budget phone (test plan) |
| Learners and teachers compare us with VEX's 3D playgrounds | "Looks basic" | Lite UI and CI makes 2D look deliberate; our pitch is "the same program drives your real cardboard robot", which VEX VR can't offer |
| Headless replay of MicroPython on the server costs compute | Cost at scale | Replay only what counts (formal tasks, top competition places), not every practice run |
| (v0.4) Printers shrink pages ("fit to page") | Course the wrong size; robot doesn't fit | 100 mm calibration square and a "print at 100 %" step on the first page; cells leave 40 mm each side of the robot |
| (v0.4) Some inkjet black ink is invisible to IR line sensors | Line sensors miss printed lines | Printed lines are a **placement guide**; learners lay black insulation tape on them (lesson note and test-plan row) |
| (v0.4) Cardboard walls fall over or move when bumped | Unfair runs | L-fold or triangle wall pieces with tabs; tape or Prestik at the base; standard 60 mm height |
| (v0.4) Not enough floor space in classrooms | Course can't be built | Course sizes from 3×3 cells (0.6 m square); desks pushed together; corridor or hall for competitions |
| (v0.4) Screen and floor results differ | Disputes in competitions | Competitions are scored on screen by headless replay; floor runs are for practice and showcases |

## 13. Reference review: VEX (v0.3)

The owner asked to consider VEXcode Pro V5 for the virtual world.

### 13.1 What VEXcode Pro V5 is — and the better reference

- **VEXcode Pro V5 is not a simulator.** It is a desktop C++ editor that compiles code for the physical VEX V5 brain, and VEX has **ended it**: it is end-of-life, replaced by a VS Code extension. Nothing to copy there for M4, and C++ is far beyond Grade 3–9 needs.
- **The VEX product that matters is VEXcode VR** (vr.vex.com): a virtual robot in 3D "playgrounds" (maze, grid map, art canvas, castle crasher, ocean clean-up), coded in blocks, "Switch" blocks or Python, in a Chrome-based browser. Free tier with basic playgrounds; Enhanced (~USD 199/educator/year) and Premium (~USD 499/educator/year) add Python, more playgrounds and competition "virtual skills" worlds.
- VEX's own guidance agrees with our approach: virtual robots are meant to **supplement** real building, not replace it.

### 13.2 Borrow (cheap in 2D, high learning value)

| VEX VR feature | Our version | Why |
|---|---|---|
| Monitor / dashboard of live sensor data | FR-11 Monitor + one graph | Makes decisions visible ("the light dropped below 50, so it stopped"); best debugging aid for beginners |
| Coordinate system + location details | FR-12 grid + readout | Direct CAPS maths link (grid references, coordinates, angles); great for PRIMM predictions |
| Pen + art canvas | FR-13 pen (servo pen-lifter) | Loved by younger learners; teaches angles and repetition. Our twist: it maps to a **real cardboard pen-lifter** with a micro:bit servo, so it stays buildable |
| Grid map and maze playgrounds | Worlds 5 and 6; courses (§14) | Already matched in 2D; tiny JSON files |
| Virtual skills competitions | Headless replay (FR-14); seeded mazes (FR-18) | School-vs-school competitions with cheat-proof scoring |
| Blocks ↔ Python switching | Already in M3 | Nothing to add |

### 13.3 Do differently (and why we can beat it)

- **2D, not 3D.** 3D needs WebGL, a GPU and megabytes of assets; VEX VR targets Chrome on Chromebooks/Mac/Windows. Our users are on budget Android phones and zero-rated data. 2D top-down shows everything a learner needs for drive, sense and decide, at under 30 KB.
- **The same program drives the real robot.** VEX VR runs its own virtual robot API; code doesn't move to a micro:bit cardboard cart. Ours does (ADR-0007). This is our strongest difference — say it on the landing page.
- **Free for everyone.** Python, the Monitor and all worlds are free; VEX charges per educator for these.
- **Offline-first** after first visit (FR-9); VEX VR needs to be online in the browser for most users.

### 13.4 Not now

- Magnet / object pick-up and the distance sensor: need moving objects and the extension format review; add together later.
- Point-of-view (camera on the robot) view: needs 3D or ray-casting; low learning value per KB.

### 13.5 Competition readiness

Headless replay (FR-14) means a competition entry is the **program**, not a claimed time. The server re-runs it on the world with a fixed seed and ranks by its own run report. This supports the owner's plan for virtual competitions (school vs school, club vs club) and "human checks top competition places" without trusting the device.

## 14. Courses & Seasons (v0.4)

### 14.1 Idea

Take the best of both big competition formats and make them free and buildable from cardboard:
- **From LEGO (FIRST LEGO League robot game):** a themed course with several small missions worth points, a short timed round, and a new theme each season.
- **From VEX (VR maze, Virtual Skills):** a skills run you can repeat to beat your best score, with a leaderboard.
- **Ours:** each course is one data file that runs **on screen** and **on the floor** (printed A4 tiles, tape lines, cardboard walls). A class with no robot plays it on the projector; a club with a robot builds it on the floor; both use the same program.

### 14.2 Three ways to build a course

| Option | What's on the floor | Sensors used | Best for | Floor cost (4×4 course) |
|---|---|---|---|---|
| **A. Line course** | Printed tiles + black insulation tape | Line sensors (left/right), light level | Grade 5–6 | ~15 A4 pages + 1 roll of tape (~R20) |
| **B. Line course + cardboard pieces** (owner's option 1) | Line course plus 3–5 cardboard pieces: tunnel with a roof, wall blocking a shortcut, target or gate flap | Line sensors, light level, whiskers | Grade 5–9 mission courses | Option A + 1–2 cereal boxes |
| **C. Cardboard walled maze** (owner's option 2) | Printed tiles (as a placement grid) + cardboard wall pieces on cell edges | Whiskers (or shake) | Grade 4–6 first mazes; Grade 7–9 smarter strategies | ~15 A4 pages + 7–10 cereal boxes |

**Assumption challenged.** A walled maze is the classic picture, but walls cost the most material, can move when bumped, and on their own only give a robot "I touched something" — so the full-maze version (C) is for younger learners with simple "bump and turn" logic, while older learners get more algorithm depth from a **line maze** (A) at a fraction of the cost. Option B gives the best of both and is the default for seasons.

### 14.3 The whisker bumper (new sensor, ~R1)

- **Build:** a paper clip bent into a whisker, wired to 3V; a strip of kitchen foil on the cardboard robot front, wired to the pin the robot profile gives for the left or right whisker (the lesson shows the wiring diagram for the learner's board). When the whisker bends back and touches the foil, "whisker pressed?" answers yes (the pin's pull-down keeps it at no otherwise).
- **Teaches:** switches, open and closed circuits, digital input (CAPS Grade 5–6 electrical circuits and inputs/outputs).
- **On screen:** the simulator answers the same whisker calls when the robot's front corners touch a wall or target (FR-15), so code moves between screen and floor unchanged.
- **Template:** cardboard bumper front with whisker holes and foil zones (M2 template library); lesson `p2-whisker-01`.
- Robots without whiskers still work: worlds with `bump: "shake"` keep the v0.2 shake behaviour, and the real micro:bit's accelerometer detects a hard bump too, less reliably.

### 14.4 Course format and pieces

- **Grid:** 200 mm cells (the cart is 120 mm across, leaving 40 mm each side). Courses from 3×3 (0.6 m square) to 6×6 (1.2 m square).
- **Standard cardboard pieces** (all with printable templates, all sized to the grid):
  - **wall**: 200 mm or 400 mm long, 60 mm high, L-fold or triangle with tabs so it stands on its own;
  - **tunnel**: 200 mm long with a roof (dark for the light sensor), 150 mm wide inside;
  - **target / gate flap**: a hinged flap the robot touches with a whisker (on screen: a target; on the floor: it flips over, so judges can see it was done);
  - **zone markers**: printed on the tiles (hatched), no cardboard needed.
- **Missions** (FR-17) use only these fixed pieces: reach zone, stop in zone, visit checkpoints in order, touch target, pass under tunnel, return home. No freely moving objects in v0.4.
- **Scoring example:** each mission 20–50 points; time bonus up to 30 points; −5 per wall touch; round limit 2 minutes (like the LEGO robot game's short rounds).
- **Course JSON** extends the world format with `grid`, `lines`, `walls` (piece type, cell, edge), `missions` and `scoring`; checked at build like worlds.

### 14.5 First courses (launch)

| Course | Option | Grade | Missions |
|---|---|---|---|
| Grid delivery 3×3 | A (grid only, no lines needed) | 3–4 | "Deliver the seed to B3"; avoid the puddle zone |
| Line junction 4×3 | A | 5–6 | Follow the line, stop in the tunnel, take the correct branch |
| Bump maze 4×4 (random) | C | 4–6 | Escape the maze; fewest wall touches wins |
| Line maze 4×4 (random) | A | 7–9 | Reach the finish; fastest time |
| Rhino Patrol mission course 5×4 | B | 5–9 | Season 1 (below) |

### 14.6 Seasons

- A **season** is a yearly theme with 3 courses (Grade 3–4, 5–6, 7–9), mission names and artwork, plus printable tiles and templates. Past seasons stay playable.
- **Season 1: "Rhino Patrol"** (ties to the rhino tracker collar work): patrol the fence line (line follow), check the waterhole (stop in zone), open the gate (touch flap), pass through the dark thicket (tunnel), return to the ranger station (home).
- Seasons feed the newsletter (results, badge rankings), school-vs-school and club-vs-club competitions, and are the natural slot for a sponsor or NGO partner.

### 14.7 Competition formats

- **Practice (any time):** any course, any maze number; personal best kept on the device.
- **Season skills run:** the season course on screen; best score verified by headless replay; leaderboard by school, club and grade band.
- **Surprise maze day:** a secret maze number revealed at the start (FR-18), so programs must sense rather than memorise moves; server replay ranks entries; a human checks the top places.
- **Floor showcase:** the same course built on the floor at a school or club event — for showing, filming (15-second video in the submission kit) and fun, not for official ranking.

### 14.8 Access and impact

- **No robot:** the whole course works on screen, offline, on a budget phone or projected for a class.
- **No printer:** draw the grid with chalk or masking tape using the assembly map's measurements.
- **No cereal boxes:** any cardboard works; wall pieces can also be bricks or books in a pinch (the build sheet shows positions, not materials).
- **Scale:** courses are a few KB each; a new season is content, not code.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-23 | First draft |
| 0.2 | 2026-11-23 | Approved; step 1 done; run report for the submission kit (FR-10, §6.1); "real floor" and the 1 s advance limit |
| 0.3 | 2026-11-23 | VEX review (§13): VEXcode Pro V5 is an end-of-life C++ editor, not a simulator; VEXcode VR is the real reference. Added Monitor (FR-11), grid and location (FR-12), pen on P16 (FR-13), headless replay (FR-14), grid-map and art-floor worlds, step 1b, pen-art lesson |
| 0.4 | 2026-11-23 | Owner approved v0.3 and Courses & Seasons (§14): line courses, line + cardboard pieces, cardboard walled mazes; whisker bumper on P12/P15 (FR-15); course layers, missions and scoring (FR-16, FR-17); seeded random mazes (FR-18); print course as A4 tiles with build sheet (FR-19); seasons (FR-20), Season 1 "Rhino Patrol"; steps 1c, 2b, 5; new lessons and cardboard templates; risks for printing, IR ink and wall stability |
| 0.5 | 2026-11-23 | Draft following ADR-0008: robot calls instead of pins everywhere (sensors, pen, FR-2/3/11/13/15, §6 diagram, §14.3); new FR-21 and §6.2 (robot calls, simulator profile proposal); step 1c starts with the switch to robot calls; two acceptance criteria; dropped the P12–P15 simulator patch and pin-check notes |
