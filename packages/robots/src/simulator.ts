// The built-in simulator profile (ADR-0008; M4 spec §6.2). On the on-screen micro:bit,
// rfa_robot.py sends the same robot calls to the robot world through the small _rfa_sim module
// (simulator patch 0005). Sensor reads return the latest answer the world pushed in, at once.
// The same file is used whichever board the learner picked, so the screen behaves the same for
// every profile.
export const SIMULATOR_RFA_ROBOT_PY = `# rfa_robot.py - Robots For All robot calls: the on-screen robot (ADR-0008).
import _rfa_sim


def motor(side, speed):
    if side in ("left", "right"):
        _rfa_sim.call("motor_" + side, max(-100, min(100, int(speed))))


def stop():
    _rfa_sim.call("stop", 0)


def line(side):
    return _rfa_sim.read("line_" + side) == 1


def whisker(side):
    return _rfa_sim.read("whisker_" + side) == 1


def pen(down):
    _rfa_sim.call("pen", 1 if down else 0)
`;

/** A robot call from the on-screen micro:bit, as the simulator reports it. */
export type RobotCall =
  | { call: 'motor_left' | 'motor_right'; value: number }
  | { call: 'stop'; value: number }
  | { call: 'pen'; value: number };

/** Names of the sensor answers the world pushes in (1 = yes, 0 = no). */
export const SENSOR_NAMES = ['line_left', 'line_right', 'whisker_left', 'whisker_right'] as const;
export type SensorName = (typeof SENSOR_NAMES)[number];

/** Checks a robot call message from the simulator iframe (its origin is checked by the caller). */
export function parseRobotCall(data: unknown): RobotCall | null {
  if (data === null || typeof data !== 'object') return null;
  const { call, value } = data as Record<string, unknown>;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (call === 'motor_left' || call === 'motor_right') {
    return { call, value: Math.max(-100, Math.min(100, Math.round(value))) };
  }
  if (call === 'stop' || call === 'pen') return { call, value: value ? 1 : 0 };
  return null;
}
