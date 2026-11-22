# Spec: M3 — Code (block coding and micro:bit)

> **Version:** 0.1 · **Date:** 2026-11-22 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-22)
> Depends on: M2 (lessons 1–10 built), CLAUDE.md 0.8, ADR-0001, ADR-0004. Proposes ADR-0005. Keep the version line current; log changes at the bottom.

---

## 1. Purpose

Phase 2 is "Control": learners make a robot move forward, stop and reverse, light LEDs and react to sensors. M3 gives them a **block coding editor** that runs on a cheap phone, a **virtual micro:bit** so every learner can code even without hardware, and a way to **send programs to a real micro:bit** when a school or club has one.

**Why now:** the scribble-robot lesson (p1-motor-01) ends with a battery, a switch and one motor. Phase 2 replaces the switch with code.

**Reality check that shapes this spec:** a micro:bit costs several hundred rand, so most learners will share one per group, and many will have none. The virtual micro:bit is therefore not an extra: it is how most learners will do these lessons. Hardware is the reward, not the requirement.

---

## 2. Scope

### In scope
1. **Block editor** at `/code/`: drag-and-drop blocks (Blockly) with a small, child-friendly set of blocks, usable by touch at 360 px and by keyboard.
2. **One program model, two outputs**: blocks are saved as a small JSON program that (a) runs in the **virtual micro:bit** and (b) is turned into **MicroPython** for a real board.
3. **Virtual micro:bit**: 5×5 LEDs, buttons A and B, light-level and tilt controls, and a **motor indicator** for the two motor pins. Screen-reader friendly.
4. **Python view**: read-only MicroPython shown next to the blocks (the PRIMM "Investigate" step: read the code the blocks make).
5. **Send to micro:bit**: build a `.hex` file in the browser; flash over **WebUSB** (Chrome/Edge, desktop and Android) or **download the .hex** and copy it to the MICROBIT drive (every other device).
6. **Save and share without accounts**: programs saved on the device; export/import a program file; starter programs open from a lesson.
7. **Six Phase 2 lessons** (§7), drafts, same lesson format as Phase 1 plus a starter program and wiring diagrams.
8. **Offline**: editor and virtual micro:bit work offline after first use; the MicroPython firmware is cached the first time a learner downloads or sends a program.

### Out of scope (later)
Typing Python (later milestone, with Pyodide or the micro:bit Python Editor), ESP32 boards (see §13), Bluetooth flashing (needed for iPhone), 2D robot simulator (M4), accounts and cloud saving (M5), AI help (M6), translations of block text beyond English (wired for i18n now, translated later).

---

## 3. Users and journeys

**Lerato, Grade 5 learner, no micro:bit, Android phone:**
1. Opens lesson "Blink a heart", taps **Open in code editor**; the starter program loads.
2. Predicts what it will do, taps **Run**: the virtual micro:bit shows a beating heart.
3. Opens the **Python** tab and finds the `sleep(500)` that matches the "pause" block; changes 500 to 100 and sees the heart beat faster (Investigate, Modify).
4. Her program is still there tomorrow, offline.

**Mr Dlamini, club coach, one micro:bit for 12 learners, Windows laptop:**
1. Each group builds their program on phones with the virtual micro:bit.
2. When a group is ready, they **export** the program file (or he opens it from their phone via WhatsApp file share) on the laptop.
3. He plugs in the micro:bit, taps **Send to micro:bit**, picks the board once, and the robot from the scribble lesson now drives forward and stops when button A is pressed.

**Parent at home with an iPhone and a micro:bit:** taps **Download .hex**, follows the on-screen steps to copy it with a computer. (WebUSB is not available on iPhone.)

---

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | `/code/` loads a Blockly workspace with a **toolbox of about 25 blocks** in categories: Basic (on start, forever, show icon, show number, show text, clear, pause), Input (on button A/B pressed, button is pressed, light level, tilt), Logic (if/else, compare, and/or/not, true/false), Loops (repeat n times, while), Maths (number, + − × ÷, random), Variables (one or more named numbers), Pins (digital write P0/P1/P2), Motor (motor forward / reverse / stop on P0+P1) |
| FR-2 | Blocks are stored as a **program JSON** (versioned, validated with Zod). This JSON, not Blockly's own format, is what is saved, exported and shipped with lessons |
| FR-3 | **MicroPython generator**: program JSON → readable MicroPython using the standard `microbit` module; same input always gives the same output |
| FR-4 | **Interpreter**: program JSON runs in the browser against the virtual micro:bit, step by step, with real pause timing, a **Stop** button and a guard against endless loops freezing the page. It never uses `eval` or `new Function` |
| FR-5 | **Virtual micro:bit** shows LEDs, buttons A/B (tap or keyboard), a light slider, tilt buttons, and pin/motor state (forward, reverse, stopped). Changes are also announced as text for screen readers |
| FR-6 | **Python tab** shows the generated MicroPython, read-only, with a copy button |
| FR-7 | **Download .hex**: combine the program with the official MicroPython firmware (universal hex for micro:bit V1 and V2) in the browser and download it, with short "copy to MICROBIT drive" steps |
| FR-8 | **Send to micro:bit** over WebUSB where available (feature-detected); clear messages for "no board", "permission refused", "unplugged during send"; falls back to Download .hex |
| FR-9 | Programs **auto-save on the device**; a "My programs" list to open, rename and delete; **export/import** as a `.rfa.json` file (size-limited and validated on import) |
| FR-10 | Lessons may name a **starter program** (`starter_program: blink-heart` → `content/lessons/<id>/programs/blink-heart.json`), shown as **Open in code editor**; the build fails if the file is missing or invalid |
| FR-11 | All learner-facing text in the editor, toolbox and blocks goes through i18n (Paraglide messages passed to Blockly) |
| FR-12 | The editor's JavaScript loads **only on `/code/`**; lesson pages stay within their M2 budget |

---

## 5. Non-functional requirements

- **Size:** `/code/` first load **≤ 450 KB compressed** (Blockly + editor + virtual micro:bit), measured in CI like the other page budgets. The MicroPython firmware (about 1–2 MB uncompressed; to be measured in step 1) is **not** downloaded until the learner taps Download or Send.
- **Speed:** usable on a low-end Android phone; Lighthouse mobile performance and accessibility **≥ 90** on `/code/` (performance target may be revised in ADR-0005 if the spike shows Blockly cannot reach it; accessibility may not).
- **Mobile:** works at 360 × 640 in portrait: toolbox as a collapsible drawer, workspace fills the screen, Run/Stop always visible; virtual micro:bit and Python in tabs.
- **Accessibility:** Blockly's keyboard navigation plugin; the virtual micro:bit is fully usable by keyboard and screen reader. Known limits of block editors for blind learners are recorded in the test plan, with the Python view as the text alternative.
- **Offline:** editor, blocks and virtual micro:bit work offline after the first visit to `/code/` (cached on visit, **not** pre-cached for every visitor of the site, to save data). The firmware is cached on first use.
- **Security headers unchanged:** the strict CSP (`script-src 'self'`, no inline code, no `unsafe-eval`) stays. Blockly is loaded with its CSS injection turned off and its stylesheet served as a file.
- **Languages:** English at launch; all strings keyed.

---

## 6. Technical architecture

```
            Blockly workspace (UI only)
                     │  serialise
                     ▼
            Program JSON  (packages/blocks: schema + block definitions)
           ┌─────────┴──────────┐
           ▼                    ▼
   Interpreter (TS)       MicroPython generator (TS)
           │                    │
           ▼                    ▼
   Virtual micro:bit      main.py ──► microbit-fs + MicroPython firmware ──► .hex
   (Svelte island)                                         │
                                         WebUSB (microbit-connection)  or  download
```

- **`packages/blocks`** (new): block definitions, toolbox, program JSON schema (Zod), Blockly ⇄ program JSON conversion, MicroPython generator, interpreter. Pure TypeScript, unit-tested without a browser. The interpreter will be reused by the 2D simulator in M4.
- **`apps/web/src/pages/code/`**: the editor page, one Svelte island; Blockly imported only here.
- **Device library choice (ADR-0005)**, proposed:
  - Blockly (Apache-2.0) for blocks.
  - `@microbit/microbit-fs` (MIT, micro:bit Educational Foundation) to put `main.py` into the MicroPython hex.
  - `@microbit/microbit-connection` (MIT) for WebUSB flashing. It is still an **alpha** release, so it is pinned to an exact version and wrapped behind our own small interface. Download .hex always works without it.
  - MicroPython firmware hex (MIT) served from our own domain.
- **Why not embed MakeCode** (the CLAUDE.md plan said "MakeCode, self-hosted if needed"): MakeCode is excellent but is a whole separate app of many megabytes, loads from makecode.org by default (a third-party domain, which breaks the zero-rating rule), has its own interface that can't follow our lessons or i18n, and is heavy on low-end phones. Our own small editor costs more to build but fits the lesson flow, the data budget and the offline rule. Learners who outgrow it can move straight to MakeCode or the micro:bit Python Editor; the Python view prepares them. ADR-0005 records this and CLAUDE.md §5 is updated.
- **Hardware for Phase 2 lessons:** micro:bit (V1 or V2), a 2-channel **L9110S-type motor driver** module, 2 × AA battery holder for the motors (separate from the micro:bit's supply), crocodile leads on pins P0, P1 and GND, and the motor from p1-motor-01. The motor is never powered from the micro:bit's pins.
- **Lesson format:** adds optional `starter_program` and `hardware` (`none` | `microbit` | `microbit-motor`) to the schema; every Phase 2 lesson must work with `hardware: none` in the virtual micro:bit, with the real board as an extension.

---

## 7. Phase 2 lessons (drafts)

| # | Id | Lesson | Grades | Big idea (CAPS Coding and Robotics, to confirm) | Hardware |
|---|---|---|---|---|---|
| 1 | `p2-display-01` | Blink a heart | 4–5 | Sequence, output, loops | Optional micro:bit |
| 2 | `p2-button-01` | Button-controlled faces | 4–5 | Input, events, selection (if/else) | Optional micro:bit |
| 3 | `p2-light-01` | Automatic night light | 5–6 | Sensors, comparing values, decisions | Optional micro:bit |
| 4 | `p2-motor-01` | Go and stop | 5–6 | Actuators, digital output, pins | micro:bit + motor driver (virtual first) |
| 5 | `p2-motor-02` | Forward, stop, reverse | 5–6 | Two-pin motor control, algorithms | micro:bit + motor driver (virtual first) |
| 6 | `p2-robot-01` | Robot that reacts | 6–7 | Combining sensors, loops and motors | micro:bit + motor driver (virtual first) |

Each lesson: PRIMM body with a starter program; Predict uses the blocks and the Python view; numbered diagrams; wiring diagram for 4–6 (battery-only, 3 V motor supply, checked as an electrical design per CLAUDE.md §8); `status: in_review` until the test plan is done.

---

## 8. Security, privacy and child safety

- **Data collected: none.** Programs stay on the device (browser storage). No accounts, no uploads, no analytics. POPIA: no personal data processed by this feature.
- **Threat notes:**
  - *Imported program files* are untrusted: size limit (100 KB), JSON parse in a try/catch, Zod validation, unknown blocks rejected, and the interpreter has no way to reach the network, the DOM outside the virtual micro:bit, or storage.
  - *No code execution from text*: the interpreter walks the program JSON; nothing is evaluated as JavaScript. CSP keeps `unsafe-eval` off.
  - *WebUSB* is only requested after a tap, only for micro:bit vendor IDs, and only sends the hex we built.
  - *Generated Python* is built from validated blocks; text blocks are escaped so a learner's text can't break out of a string.
- **Electrical safety (Phase 2 lessons):** AA batteries only, motors on their own battery holder through a driver, never coin cells, never mains, an adult checks wiring before power-on (recorded in the test plan).
- **Shared devices:** "My programs" are per browser; the editor says so, so learners on a shared phone know others can see them.

---

## 9. Acceptance criteria

- [ ] On a 360 px phone emulation, a learner can drag blocks by touch, run, stop, and see the virtual micro:bit respond (e2e).
- [ ] The same program JSON gives the expected MicroPython (golden tests) **and** that Python runs without errors against a stub `microbit` module in CI.
- [ ] Interpreter and generator agree: for each sample program, the sequence of LED/pin changes from the interpreter matches the stub run of the generated Python (CI).
- [ ] Download .hex produces a file that `microbit-fs` can read back with the same `main.py` (CI).
- [ ] Send to micro:bit is hidden or falls back cleanly where WebUSB is missing (e2e on a non-WebUSB profile).
- [ ] `/code/` works offline after one visit; Download .hex works offline after one use (e2e).
- [ ] Page budget and Lighthouse targets in §5 pass in CI; lesson pages still pass their M2 budgets.
- [ ] No CSP violations on `/code/` (e2e console check).
- [ ] Six Phase 2 lessons build, link starter programs, and pass the lesson checks; rows added to `docs/test-plan.md`.
- [ ] Deferred to `docs/test-plan.md`: flashing real micro:bit V1 and V2 from Windows Chrome and Android Chrome (USB-OTG), TalkBack on `/code/`, the wiring checks, and classroom trials.

---

## 10. Work plan for Claude Code

One PR per step. CI must pass before merging (owner decision 2026-11-22). ⏸ marks a stop for review.

1. **Spike + ADR-0005**: Blockly under the strict CSP at 360 px, measured size; microbit-fs builds a hex from a `main.py`; microbit-connection bundles. Decide and record. ⏸ only if the spike breaks a non-negotiable (CSP, size, licence).
2. **`packages/blocks` core**: program JSON schema, MicroPython generator, interpreter, sample programs, golden + stub-Python tests.
3. **Editor page** `/code/`: Blockly island, toolbox, mobile layout, keyboard navigation, auto-save, My programs, import/export, Python tab, i18n.
4. **Virtual micro:bit**: LEDs, buttons, light, tilt, motor pins, screen-reader announcements; wired to the interpreter.
5. **Hex and WebUSB**: Download .hex, Send to micro:bit, firmware served from our domain and cached on first use, offline tests.
6. **Lesson integration + Phase 2 lessons 1–3**: schema fields, Open in code editor, three drafts with starter programs.
7. **Phase 2 lessons 4–6**: motor lessons with wiring diagrams; test-plan rows; CLAUDE.md, spec and ADR updates.
8. **Publishing pass**: after the deferred checks in `docs/test-plan.md` ⏸

---

## 11. AI opportunities

- Later (M6): the helper explains a learner's program in plain words or suggests why it doesn't work, using the program JSON (no personal data).
- Back office: generate draft starter programs and lesson variations from the block set, always human-reviewed.

## 12. Revenue notes

Core editor and virtual micro:bit stay free. A low-cost **Phase 2 kit** (micro:bit, motor driver, leads, battery holder, motor) is a natural add-on for the later kit store, as is a school pack (one kit per group).

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Blockly too heavy or slow on low-end phones | Misses size/Lighthouse targets | Measure in the spike; trim blocks and plugins; lazy-load; record numbers in ADR-0005 |
| Blockly needs inline styles that break the CSP | Security regression | Turn off CSS injection; serve its CSS as a file; test for CSP violations in e2e |
| `microbit-connection` is alpha | Flashing breaks on an update | Pin the exact version, wrap it, Download .hex always available |
| Most learners have no micro:bit | Lessons feel incomplete | Every lesson completes fully in the virtual micro:bit |
| No WebUSB on iPhone | Can't flash from iPhone | Download .hex with computer steps; Bluetooth flashing considered later |
| Block editors are hard for blind learners | Accessibility gap | Keyboard navigation, text announcements, Python view; recorded in the test plan |
| ESP32 boards are cheaper than micro:bit | Cost barrier | Program JSON is board-neutral; an ESP32 MicroPython target can be added later (flash via Web Serial) |

## 14. Owner actions

- None to start. Later (test plan): borrow or buy one micro:bit V2, one L9110S motor driver and crocodile leads for the real-device checks; confirm local prices for the kit list.

---

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-22 | First draft; approved by the owner |
