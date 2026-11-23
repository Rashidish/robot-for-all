# ADR-0007: The robot world reuses the on-screen micro:bit

- **Status:** Accepted (owner approved M4 spec v0.2, 2026-11-23). Its link to motor *pins* is replaced by
  robot calls in [ADR-0008](../ADR-0008-robot-profiles_v1.0.md); the rest stands.
- **Date:** 2026-11-23 (written down in M4 step 1; the decision was taken with M4 spec v0.2)
- **Decider:** Rashid Ishmail

## Context
CLAUDE.md §5 planned the M4 simulator as Canvas 2D plus a small physics library, running block code
itself. Since ADR-0006 the code editor already runs real MicroPython in the on-screen micro:bit, and
learners can type Python. A second interpreter would never behave exactly like the real board and
would not run typed Python. Non-negotiables that apply: mobile-first and cheap phones, low data,
offline, free at the core.

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. Own simulator: Canvas 2D + physics library + our interpreter | Physics library alone 30–100 KB | Yes | Varies | High | Second engine; blocks only; drifts from the real robot |
| B. Reuse the on-screen micro:bit; add a small 2D robot world that reads its outputs and feeds its sensors | Under 30 KB, no dependency | Yes | Ours (MIT) | Low | One engine for blocks and typed Python; a two-wheel cart needs about 50 lines of maths |
| C. 3D world (like VEXcode VR) | Megabytes, WebGL, GPU | Hard | Varies | Very high | Not for budget Android phones (M4 spec §13) |

## Decision
Option B: the on-screen micro:bit runs the learner's program; `packages/sim` is a pure TypeScript
robot world (no DOM, no dependencies) that turns the program's motor and pen output into movement and
answers its sensors.

## Why
- The program that drives the screen robot is the program that drives the real robot.
- No physics library: differential drive, circle-against-rectangle walls and point sensors are enough
  for drive, sense and decide, and are tiny.
- Fixed 20 ms steps make every run repeatable, so a run report can be checked by replaying it.

## How it works (as built in M4 step 1)
- **Robot calls, not pins** (ADR-0008): `setMotor(side, speed)`, `stopMotors()`, `setPen(down)` in;
  `line(side)`, `whisker(side)`, `lightLevel()`, `wasShaken()` out. In the editor, a built-in
  simulator profile sends these between the on-screen micro:bit and the world; the world pushes sensor
  answers so reads never wait (M4 spec §6.2).
- Kinematics `v = (vL + vR) / 2`, turn rate `(vL − vR) / track`; cart track 100 mm, bump radius 60 mm,
  200 mm/s at 100 %. Each advance moves at most 1 s.
- When the cart's body meets a wall it slides along it (only the part of the move into the wall is
  removed), so it doesn't stick on corners. One continuous touch counts as one bump.
- Worlds and courses are checked JSON in `content/worlds/`; the run report fingerprints the exact world
  (`worldHash`) and program (`programHash`).

## Consequences
- Easier: one engine; typed Python works; tiny download; headless replay on a server (M4 spec §13.5).
- Harder: the world depends on a small simulator patch to exchange robot calls, like the M3
  pin-output patch. Done: `patches/simulator/0005-robot-calls.patch` adds a `_rfa_sim` module
  (robot calls out, sensor answers pushed in).
- Watch: the upstream embedding API is "not yet stable" (ADR-0006); we pin a version and test it in CI.
