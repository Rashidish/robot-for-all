// The rfa_robot MicroPython module (ADR-0008): the same robot calls on every board, with only
// this board's details inside. It is added next to main.py, like game.py, when a program uses it.
//
//   import rfa_robot
//   rfa_robot.motor("left", 60)      # −100 (full backward) … 100 (full forward)
//   rfa_robot.stop()
//   rfa_robot.pen(True)              # pen down; False lifts it
//   rfa_robot.line("left")           # True over a dark line
//   rfa_robot.whisker("right")       # True while pressed
import { type PinMotor, type Profile, sensorPins } from './profile';

/** Most bytes the module may use on the micro:bit, profile data included (ADR-0008). */
export const MODULE_BUDGET_BYTES = 4096;

/** Pen servo duty (0–1023 at a 20 ms period): 0° = pen down, 90° = pen up (M4 spec FR-13). */
export const PEN_DOWN_DUTY = 26;
export const PEN_UP_DUTY = 77;

/** "Test my robot" fixes, kept in the learner's settings on the device (ADR-0008 risks). */
export interface Fixes {
  flipLeft?: boolean;
  flipRight?: boolean;
  swapMotors?: boolean;
  flipLineSensors?: boolean;
}

/** The rfa_robot.py source for this board, with the learner's fixes applied. */
export function rfaRobotPy(profile: Profile, fixes: Fixes = {}): string {
  if (profile.motors.method !== 'pins') {
    throw new Error(`rfa_robot: no driver yet for ${profile.motors.method} boards (${profile.id})`);
  }
  const flip = (m: PinMotor, yes: boolean | undefined): PinMotor =>
    yes ? { forward: m.backward, backward: m.forward } : m;
  const own = profile.motors.right;
  const [first, second] =
    fixes.swapMotors && own ? [own, profile.motors.left] : [profile.motors.left, own];
  const left = flip(first, fixes.flipLeft);
  const right = second ? flip(second, fixes.flipRight) : undefined;

  const sensors = sensorPins(profile);
  const used = new Set<number>();
  const pin = (n: number) => {
    used.add(n);
    return `pin${n}`;
  };
  const motorEntries = (
    [
      ['left', left],
      ['right', right]
    ] as const
  ).flatMap(([side, m]) => (m ? [`"${side}": (${pin(m.forward)}, ${pin(m.backward)})`] : []));
  const pair = (l: number | undefined, r: number | undefined) =>
    [l === undefined ? '' : `"left": ${pin(l)}`, r === undefined ? '' : `"right": ${pin(r)}`]
      .filter(Boolean)
      .join(', ');
  const lineEntries = pair(sensors.lineLeft, sensors.lineRight);
  const whiskerEntries = pair(sensors.whiskerLeft, sensors.whiskerRight);
  const penPin = sensors.pen === undefined ? 'None' : pin(sensors.pen);
  const dark = fixes.flipLineSensors ? 1 - profile.lineDark : profile.lineDark;
  const imports = [...used].sort((a, b) => a - b).map((n) => `pin${n}`);

  return `# rfa_robot.py - Robots For All robot calls (ADR-0008). Board: ${profile.id} v${profile.version}.
# Made by the code editor for this board: programs call these, never pins.
from microbit import ${imports.join(', ')}

_MOTORS = {${motorEntries.join(', ')}}
_LINE = {${lineEntries}}
_WHISKER = {${whiskerEntries}}
_PEN = ${penPin}
_DARK = ${dark}

for _p in _WHISKER.values():
    _p.set_pull(_p.PULL_DOWN)


def motor(side, speed):
    pins = _MOTORS.get(side)
    if pins is None:
        return
    speed = max(-100, min(100, int(speed)))
    on, off = pins if speed >= 0 else (pins[1], pins[0])
    off.write_digital(0)
    if speed == 0:
        on.write_digital(0)
    else:
        on.write_analog(abs(speed) * 1023 // 100)


def stop():
    for side in _MOTORS:
        motor(side, 0)


def line(side):
    p = _LINE.get(side)
    return p is not None and p.read_digital() == _DARK


def whisker(side):
    p = _WHISKER.get(side)
    return p is not None and p.read_digital() == 1


def pen(down):
    if _PEN is not None:
        _PEN.set_analog_period(20)
        _PEN.write_analog(${PEN_DOWN_DUTY} if down else ${PEN_UP_DUTY})
`;
}
