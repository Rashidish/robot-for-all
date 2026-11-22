# Spec: M4 — Simulate (2D robot and sensor world)

> **Version:** 0.1 (draft) · **Date:** 2026-11-23 · **Owner:** Rashid Ishmail · **Status:** Draft, for review
> Depends on: M3 (block editor, on-screen micro:bit, ADR-0006), CLAUDE.md 0.13.

## 1. Purpose

Most learners will never own a motor driver, let alone a robot. M4 lets every learner drive a **robot on screen**: the cart from Phase 1 with the micro:bit from Phase 2. They drive it with the same blocks and the same program they would send to a real robot, in challenges such as "stop in the tunnel", "follow the line" and "get through the maze".

**Assumption challenged.** CLAUDE.md §5 plans a separate simulator: Canvas 2D plus a physics library, running block code itself. A cheaper and more faithful design is to **reuse the on-screen micro:bit**. It already runs real MicroPython and reports motor pins (ADR-0006). The robot world only has to:
- turn pin outputs (P0/P1, P2/P8) into wheel speeds;
- feed sensor values back (light level, line sensors, bump as a shake).

This means:
- one engine runs everything, so behaviour on screen matches the real robot;
- there is no second interpreter;
- typed Python works too;
- there is no physics library: a two-wheel robot needs about 50 lines of maths.

## 2. Scope

**In scope**
- A 2D top-down **robot world** beside the on-screen micro:bit in the code editor (a "Robot" tab next to the micro:bit).
- One robot: two-wheel cart, motor A = left wheel, motor B = right wheel (motor driver extension); with only motor A, both wheels follow it (the one-motor cart from the Phase 2 lessons).
- Sensors:
  - **light level**: brightness of the floor or tunnel under the robot;
  - **two line sensors** on P13 and P14 (digital, 1 = dark line), like low-cost IR line-sensor boards;
  - **bump**: hitting a wall gives a "shake" gesture and stops the wheels.
- **Worlds as data** (JSON, like lessons): size, floor (lines, dark areas), walls, start position, goal area, and the challenge text through i18n. Five worlds at launch:
  1. open floor;
  2. dark tunnel (Robot that reacts);
  3. drive to the box and back (Forward, stop, reverse);
  4. follow the line;
  5. simple maze with bumps.
- **Challenge check:** reaching the goal (and any rule such as "stop inside the tunnel") shows "Challenge done" with the time. No account needed: the result is kept on the device. M5 records it later like an answer sheet.
- Lessons can open a world: front matter `world: <id>` next to `starter_program`.

**Out of scope (later)**
- 3D.
- Building your own robot shape.
- Distance (ultrasonic) sensor: needs an extension and the extension format review (owner reminder).
- Multi-robot competitions (Later milestone).
- Learner-made worlds (needs moderation, CLAUDE.md §7).

## 3. Users and journeys

**Learner without hardware (Grade 6).** Opens "Robot that reacts" and taps Open in code editor. Taps the **Robot** tab: the tunnel world. Runs the program and watches the cart drive into the tunnel and stop. "Challenge done". Then modifies the light threshold, as the lesson asks.

**Learner with a real robot.** Tests in the world first, then sends the same program to the real cart. They compare and explain the differences (friction, battery, light in the room). This is a CAPS "test and improve" moment.

**Teacher with one projector.** Shows the world on the projector; groups predict where the robot will stop before it runs (PRIMM Predict).

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | A Robot tab in the code editor shows a world and the robot; Run, Stop and Restart drive both the micro:bit and the robot. |
| FR-2 | Pin outputs become wheel speeds: forward/backward and PWM speed (0–100 %) per motor; differential drive turns the robot. |
| FR-3 | The light level under the robot is sent to the micro:bit about 10 times a second; line sensors set P13/P14; a wall bump sends "shake" and stops the robot at the wall. |
| FR-4 | Worlds are JSON files in `content/worlds/<id>.json`, validated at build (Zod); the build fails on an invalid world. Teachers can add a world without touching code. |
| FR-5 | Each world has a challenge: goal area, optional rules (stop inside an area, time limit, no bumps) and a "Challenge done" message with the time. |
| FR-6 | Zoom to fit a 360 px screen; the robot's trail can be shown or hidden; speed ×1 / ×2. |
| FR-7 | Keyboard and screen reader: the robot's position, heading, sensor values and challenge state are announced on request and when they change. |
| FR-8 | Lessons: `world: <id>` in front matter opens that world with the starter program. |
| FR-9 | Works offline after first use, like the editor. |

## 5. Non-functional requirements

- **Size:** the robot world adds **under 30 KB** compressed to the code page, with no new dependency. Worlds are a few KB each.
- **Speed:** 30 frames per second on a low-end Android phone. The simulation runs at fixed steps, so results don't depend on the phone's speed.
- **Accessibility:** WCAG 2.2 AA. Colours of floor, lines and robot pass contrast; patterns as well as colour mark areas.
- **i18n:** all text, including world challenges.

## 6. Technical architecture

```
Blocks / typed Python ──► on-screen micro:bit (MicroPython, iframe)
                               │ pin_output (P0,P1,P2,P8)        ▲ set_value (lightLevel, pin13, pin14, gesture)
                               ▼                                 │
                        packages/sim: robot world (TypeScript, Canvas 2D)
                          - kinematics: differential drive, fixed 20 ms step
                          - sensors: sample floor under sensor points
                          - collisions: robot circle vs wall segments
                          - challenge rules
```

- `packages/sim` (already in the repo layout): pure TypeScript, no DOM in the core, fully unit-tested. A small Svelte component draws it on a canvas.
- Kinematics: `v = (vL + vR) / 2`, `ω = (vR − vL) / track`. Robot size and top speed match the Phase 1 cart (about 0.2 m/s at 100 %).
- **One small patch to the simulator** may be needed so P13/P14 digital reads take values from the editor (check first; `pin13`/`pin14` already accept set_value).
- **ADR-0007:** "Robot world reuses the on-screen micro:bit instead of a separate interpreter and physics library". It updates the Simulator row in CLAUDE.md §5.

## 7. Security, privacy and child safety

- No personal data; challenge results stay on the device until M5.
- Worlds are build-time content reviewed like lessons; no user uploads in M4.
- Threat notes: messages between the world and the iframe are checked for origin and shape, as in M3.

## 8. Acceptance criteria

- [ ] "Robot that reacts" starter program stops the robot inside the tunnel world (e2e).
- [ ] Forward at 100 % for 1 s moves the robot the expected distance ± 5 % (unit test).
- [ ] Two motors at different speeds turn the robot the right way (unit test).
- [ ] A line-follow program written with P13/P14 finishes the line world (e2e).
- [ ] Bumping a wall gives a shake event and stops the robot (e2e).
- [ ] The robot world adds < 30 KB compressed; Lighthouse 90+ on `/code/`; works offline (e2e).
- [ ] A world with a mistake fails the build with a clear message.

## 9. Work plan for Claude Code

1. **ADR-0007 + `packages/sim` core**: world schema, kinematics, sensors, collisions, rules; unit tests.
2. **Robot tab**: canvas view, link to the on-screen micro:bit pins and sensors, controls, accessibility.
3. **Five worlds** + `world:` in lesson front matter; the Phase 2 lessons point to their worlds.
4. **Line-follow lesson** (new Phase 2 lesson, `p2-line-01`) and test-plan rows. ⏸ owner review of worlds and lesson.

## 10. AI opportunities

The M6 helper explains why a robot didn't finish a challenge, using the program and the run's sensor trace (no personal data). In the back office, AI drafts new worlds from a description, always human-reviewed.

## 11. Revenue notes

Free at the core. Later: sponsored challenge worlds (e.g. a conservation "rhino patrol" world with an NGO partner), and school competition packs built on the same worlds.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Pin messages arrive too slowly for smooth driving | Jerky robot | The world integrates at fixed steps using the latest pin state; the messages only change state |
| Learners expect the real robot to behave exactly like the screen | Frustration | Lessons say why they differ; the world has a "real floor" option with small random wheel differences |
| Low-end phones struggle with the iframe plus the canvas | Slow | Draw only what changed; ×1 speed default; measured on a budget phone (test plan) |

## 13. Owner actions

- Approve this spec, especially reusing the on-screen micro:bit instead of a separate physics simulator.
- Confirm the five launch worlds and the line-sensor pins (P13/P14).

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-23 | First draft |
