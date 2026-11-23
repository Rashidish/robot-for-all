// Scripted drivers for tests: each one behaves like a small learner program, using robot calls only.
import type { Driver, RobotCalls } from '../src/sim';
import { mulberry32 } from '../src/util';

/** The "Robot that reacts" starter program (p2-robot-01): press A, drive while light level > threshold. */
export function robotReacts(threshold = 50): Driver {
  let nextCheck = 0;
  return (robot, t) => {
    if (t < nextCheck) return;
    nextCheck = t + 100; // the program's `pause(100)`
    if (robot.lightLevel() > threshold) robot.setMotor('left', 100);
    else robot.stopMotors();
  };
}

/** A fixed list of moves, like "forward 1 s, stop, backward 1 s". */
export function timed(moves: { ms: number; left: number; right: number }[]): Driver {
  return (robot, t) => {
    let end = 0;
    for (const m of moves) {
      end += m.ms;
      if (t < end) {
        robot.setMotor('left', m.left);
        robot.setMotor('right', m.right);
        return;
      }
    }
    robot.stopMotors();
  };
}

/** Two-sensor line follower: line under the left sensor → turn left; under the right → turn right. */
export function lineFollower(speed = 60): Driver {
  return (robot) => {
    const l = robot.line('left');
    const r = robot.line('right');
    if (l && !r) drive(robot, 0, speed);
    else if (r && !l) drive(robot, speed, 0);
    else drive(robot, speed, speed);
  };
}

/** "Bump, back up, turn right": on a whisker touch (or a shake), back up, turn right, carry on. */
export function bumpBackTurnRight(
  opts: {
    speed?: number;
    backMs?: number;
    turnMs?: number;
    turnSpreadMs?: number;
    seed?: number;
    curveLeft?: number;
    /** false: a robot without whiskers, reacting to the shake from a bump only. */
    whiskers?: boolean;
  } = {}
): Driver {
  const speed = opts.speed ?? 60;
  const backMs = opts.backMs ?? 400;
  const turnMs = opts.turnMs ?? 660; // ≈ 90° at 60 %
  const spread = opts.turnSpreadMs ?? 0; // turn a random extra amount, like `random.randint`
  const rand = mulberry32(opts.seed ?? 1);
  // Left wheel speed while driving, as a share of the right: below 1 the robot curves left and hugs the left wall.
  const curve = opts.curveLeft ?? 1;
  const whiskers = opts.whiskers ?? true;
  let mode: 'forward' | 'back' | 'turn' = 'forward';
  let until = 0;
  return (robot, t) => {
    const shaken = robot.wasShaken();
    if (mode === 'back' && t >= until) {
      mode = 'turn';
      until = t + turnMs + Math.round(rand() * spread);
    } else if (mode === 'turn' && t >= until) mode = 'forward';
    if (
      mode === 'forward' &&
      (shaken || (whiskers && (robot.whisker('left') || robot.whisker('right'))))
    ) {
      mode = 'back';
      until = t + backMs;
    }
    if (mode === 'forward') drive(robot, speed * curve, speed);
    else if (mode === 'back') drive(robot, -speed, -speed);
    else drive(robot, speed, -speed);
  };
}

/**
 * Left-hand rule on a line maze with two line sensors: follow the line's left edge with the left
 * sensor (on the line → pivot left; off → spin right), so the robot always takes the leftmost
 * branch and turns round at dead ends. Line under the right sensor only → gentle right.
 */
export function leftHandLineMaze(speed = 60): Driver {
  return (robot) => {
    if (robot.line('left')) drive(robot, 0, speed);
    else if (robot.line('right')) drive(robot, speed, 0);
    else drive(robot, speed, -0.4 * speed);
  };
}

/** The bump maze strategy: curve gently left while driving; bump → back up, turn right (≈70°). */
export function bumpMaze(): Driver {
  return bumpBackTurnRight({ curveLeft: 0.3, backMs: 300, turnMs: 500 });
}

function drive(robot: RobotCalls, left: number, right: number): void {
  robot.setMotor('left', left);
  robot.setMotor('right', right);
}
