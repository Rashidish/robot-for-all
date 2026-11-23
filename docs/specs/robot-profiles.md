# Robot profiles: format and rfa_robot module

> **Version:** 0.1 · **Date:** 2026-11-23 · **Owner:** Rashid Ishmail · **Status:** Built (ADR-0008 rollout 1, part A)
> Decision: `docs/ADR-0008-robot-profiles_v1.0.md`. Used by: M3 code editor, M4 simulate (`docs/M4-simulate-spec_v0.5.md` §6.2).

## What a profile is
One JSON file per motor driver board in `content/robots/<id>.json`, checked by a unit test (and at build
from M4 step 3). The check reports the path to each problem. A content editor can add a board without
touching code.

```json
{
  "id": "l9110s-basic",
  "version": 1,
  "name": "robot_basic_two_motor_name",
  "picture": null,
  "motors": {
    "method": "pins",
    "left": { "forward": 0, "backward": 1 },
    "right": { "forward": 2, "backward": 8 }
  },
  "usedPins": [0, 1, 2, 8],
  "freePins": [13, 14, 12, 15, 16],
  "lineDark": 1,
  "detect": [],
  "status": "draft",
  "testedBy": null
}
```

| Field | Rule |
|---|---|
| `id` | lowercase words and digits joined by hyphens; the file name |
| `name` | i18n key of the board's name (`content/i18n/en.json`) |
| `picture` | file in `content/robots/images/`, or `null` until one is drawn |
| `motors.method` | `pins`: speed (PWM) on the forward or backward pin of each motor. `i2c`: a controller chip on the I2C wires (P19/P20), with `chip`, `address` and chip channels |
| `motors.right` | `null` for a one-motor board: right-motor calls do nothing |
| `usedPins` | every pin the board uses; must include the motor pins (and 19, 20 for I2C) |
| `freePins` | pins free for sensors; never the display or button pins (3–7, 9–11), the I2C wires or a used pin |
| `lineDark` | what this board's line sensors read over a dark line (1 on most, 0 on some) |
| `detect` | I2C addresses that identify the board, for auto-detect |
| `status`, `testedBy` | `published` needs `testedBy`: a person who tested the profile on a real board |

**I2C boards** are accepted by the format, but each chip needs a driver in `rfa_robot`. Drivers are
added with the first board that uses the chip (rollout 2), so an I2C profile fails the check until then.

## Sensor pins
Sensor pins are given out from `freePins` in a fixed order: left line, right line, left whisker, right
whisker, pen servo. The same board always gets the same wiring, so the wiring diagram and the code
can't disagree. A sensor with no free pin left answers "no" (and the pen does nothing).

## The rfa_robot module
The code editor makes `rfa_robot.py` for the learner's board and adds it next to `main.py` when a
program uses it, like `game.py`. Same calls on every board:

```python
import rfa_robot
rfa_robot.motor("left", 60)    # −100 (full backward) … 100 (full forward)
rfa_robot.stop()
rfa_robot.pen(True)            # pen down; False lifts it
rfa_robot.line("left")         # True over a dark line
rfa_robot.whisker("right")     # True while pressed (pins set to pull-down)
```

- Only this board's details go inside; the module stays under 4 KB (unit test).
- Pen servo: 20 ms period; 0° (duty 26) is down, 90° (duty 77) is up.
- "Test my robot" fixes (flip a motor, swap motors, flip line sensors) are applied when the module is
  made; they live in the learner's settings on the device and never reach the simulator.
- On screen, a built-in **simulator profile** sends the same calls to the robot world (M4 spec §6.2,
  next step).

## Launch profiles
Only the recommended cheapest build for now: micro:bit + L9110S two-motor module (P0/P1 and P2/P8,
the same wiring as the M3 motor driver extension), `draft` until tested on a real board. The 4–6 boards
most common in South African schools and clubs follow in rollout 2, each tested on a real board.

## Tests
`packages/robots`: format checks; fixed pin assignment; module size; the module run in real Python
against a stub `microbit` module (motor speeds and directions, stop, sensors, pull-down, pen, fixes,
one-motor boards, missing sensor pins).
