# ADR-0008: Robot profiles — code the robot, not the board

> **Version:** 1.0 · **Date:** 2026-11-23 · **Owner:** Rashid Ishmail · **Status:** Accepted (owner set the order of options, 2026-11-23)
> Affects: M3 code editor (motor and sensor blocks, extensions), M4 simulate (ADR-0007 pin link, whiskers, line sensors, pen), M2 lessons (wiring diagrams), kit ordering. Next revisions of M3-code-spec and M4-simulate-spec follow this ADR.

## Context

Learners will use whatever motor driver board they already have, or none. Boards differ in more than pin numbers:
- **pin-driven boards** take motor signals straight from micro:bit pins (and each uses different pins);
- **chip-driven boards** have a controller chip the micro:bit talks to over the shared I2C wires (P19/P20), so there are no motor pins at all.

ADR-0007 linked the simulator to motor *pins* (P0/P1, P2/P8) and M4 v0.4 fixed sensor pins (P12/P15 whiskers, P13/P14 line, P16 pen). That breaks on many real boards, and pin clashes vary by board.

## Decision

1. **Blocks and Python name robot parts, never pins**: "left motor forward 60 %", "left whisker pressed?", "line under right sensor?", "pen down".
2. A small runtime module (`rfa_robot`) on the micro:bit turns those calls into the right signals using a **robot profile**.
3. A **robot profile** is a data file (like worlds and lessons): board name and picture, motor method (pins + PWM, or I2C chip, address and channels), pins the board uses, pins free for sensors, and a wiring-diagram source. Checked at build; the build fails on an invalid profile.
4. The **simulator** reads the same robot calls (motor speeds, pen) and answers sensor calls, instead of reading pins. Behaviour is identical whichever profile the learner picked.
5. **Sensor pins are assigned automatically** from the profile's free pins (whiskers, line sensors, pen servo), and the lesson shows the **wiring diagram for that exact board**.

### How the platform finds the learner's board — in this order (owner decision)

| Order | Option | How it works | Limits |
|---|---|---|---|
| 1 | **Auto-detect** | When a micro:bit is connected (WebUSB), a short scan lists chips on the I2C wires and matches their addresses to profiles: "Looks like you have board X — use it?" | Only chip-driven boards can be detected. Several boards share the same chip address, so the result can be a **shortlist** to confirm, not a single answer. Pin-driven boards can't be detected electrically. |
| 2 | **Profiles from code** | (a) **Back office:** most board makers publish open-source MakeCode extensions with their pin and chip details; AI drafts a profile from that code, a human checks it on a real board before it goes live. (b) **Learner side:** when a learner imports a MakeCode project, the board extension it uses identifies the board and its profile is picked automatically. | Licence of each maker's code checked; a profile is never live until tested on the real board. |
| 3 | **Pick from the list / custom** | Picture chooser of supported boards; or "custom": a short form (which pins drive each motor) for a teacher with an unlisted board; the back office can turn it into a proper profile. | Needs the learner to know their board. |
| 4 | **Recommended cheapest build** (last option) | For learners with no board yet, or ordering a kit: micro:bit + a basic two-motor module (~R30, L9110S type) with crocodile clips or jumper wires. | Deliberately last: it is a constraint, not a requirement. Learners are never told to replace a board they already own. |

No board at all: everything still runs in the simulator.

## Consequences

**Good**
- Any board works, including chip-driven ones that have no motor pins.
- No pin clashes for learners: the platform assigns free pins and draws the matching wiring diagram.
- Programs move between boards and the simulator unchanged; a club with mixed boards can share code.
- New boards are content (a profile), not code, and can be drafted by AI in the back office.

**Costs**
- `rfa_robot` adds a small module to every program sent to a micro:bit (target: under 4 KB, profile data included).
- Lessons that taught "P0 and P1 drive the motor" move pin talk into the wiring step, which is still good CAPS learning (inputs, outputs, circuits).
- ADR-0007's pin link is replaced by robot calls; M4 step 1c changes the `packages/sim` interface before any UI is built (small, as the engine has no screen yet).

## Rollout

1. `rfa_robot` module, profile format and checks; simulator switched to robot calls (with M4 step 1c).
2. Launch profiles: the 4–6 boards most common in South African schools and clubs, drafted from makers' extension code and each tested on a real board; plus the recommended cheapest build.
3. "My robot" setup in the code editor (kept on the device): auto-detect first, then list, custom, and cheapest build.
4. MakeCode import picks the profile from the project's board extension.
5. Wiring diagrams per profile (back-office generation, human-checked).

## Risks

| Risk | Mitigation |
|---|---|
| Auto-detect picks the wrong board (shared chip address) | Always ask the learner to confirm, with board pictures; shortlist when unsure |
| A maker's extension code is wrong or out of date | Every profile is tested on a real board before going live; version in the profile |
| Learner picks the wrong profile; motors spin the wrong way | "Test my robot" button: each motor forward for 1 s, with "flip this motor" and "swap motors" fixes saved in the profile settings |
| Board uses pins the micro:bit display or buttons need | Profile marks them as used; sensor assignment skips them |

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-23 | Accepted; order of options set by owner: auto-detect, profiles from code, pick/custom, cheapest build last |
