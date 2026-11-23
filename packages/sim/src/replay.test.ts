import { describe, expect, it } from 'vitest';
import artFloor from '../../../content/worlds/art-floor.json';
import gridMap from '../../../content/worlds/grid-map.json';
import simpleMaze from '../../../content/worlds/simple-maze.json';
import { bumpBackTurnRight, timed } from '../test-support/drivers';
import { type CallRecord, replay } from './replay';
import { type Driver, type RobotCalls, runScripted } from './sim';
import { buildWorld, cellAt } from './world';

/** Wraps a driver so every robot call it makes is recorded with its step. */
function recording(driver: Driver, log: CallRecord[]): Driver {
  return (robot, t) => {
    const step = t / 20;
    const rec: RobotCalls = {
      ...robot,
      setMotor: (side, speed) => {
        log.push({ step, call: side === 'left' ? 'motor_left' : 'motor_right', value: speed });
        robot.setMotor(side, speed);
      },
      stopMotors: () => {
        log.push({ step, call: 'stop', value: 0 });
        robot.stopMotors();
      },
      setPen: (down) => {
        log.push({ step, call: 'pen', value: down ? 1 : 0 });
        robot.setPen(down);
      },
      line: (s) => robot.line(s),
      whisker: (s) => robot.whisker(s),
      lightLevel: () => robot.lightLevel(),
      wasShaken: () => robot.wasShaken()
    };
    driver(rec, t);
  };
}

/** Four sides of 1 s at full speed (200 mm), each followed by a 780 ms pivot (about 90°). */
const square = (): { ms: number; left: number; right: number }[] =>
  Array.from({ length: 4 }, () => [
    { ms: 1000, left: 100, right: 100 },
    { ms: 780, left: 50, right: -50 }
  ]).flat();

describe('headless replay (FR-14)', () => {
  it('replaying a recorded run gives a byte-identical run report, with and without "real floor"', () => {
    for (const realFloor of [false, true]) {
      const log: CallRecord[] = [];
      const world = buildWorld(simpleMaze);
      const original = runScripted(world, recording(bumpBackTurnRight({ whiskers: false }), log), {
        realFloor,
        seed: 7
      });
      expect(original.timeMs).toBeGreaterThan(1000); // a real run, finished or not
      const again = replay(world, log, { realFloor, seed: 7 });
      expect(JSON.stringify(again.report('p'))).toBe(JSON.stringify(original.report('p')));
    }
  });

  it('a run the learner stopped replays to the same moment', () => {
    const log: CallRecord[] = [];
    const world = buildWorld(simpleMaze);
    const original = runScripted(world, recording(bumpBackTurnRight({ whiskers: false }), log), {
      maxMs: 3000
    });
    original.stop();
    const again = replay(world, log, { endMs: original.timeMs });
    expect(again.report('p')).toEqual(original.report('p'));
    expect(again.report('p').status).toBe('running');
  });
});

describe('grid map and art floor (v0.3 worlds)', () => {
  const grid = buildWorld(gridMap);

  it('the readout names the right square at each corner and the centre of the grid map', () => {
    expect(cellAt(grid, { x: 1, y: 1 })).toBe('A1');
    expect(cellAt(grid, { x: 1199, y: 1 })).toBe('F1');
    expect(cellAt(grid, { x: 1, y: 999 })).toBe('A5');
    expect(cellAt(grid, { x: 1199, y: 999 })).toBe('F5');
    expect(cellAt(grid, { x: 600, y: 500 })).toBe('D3');
  });

  it('"2 squares east, turn right, 3 squares south, stop" reaches C4', () => {
    const sim = runScripted(
      grid,
      timed([
        { ms: 2000, left: 100, right: 100 },
        { ms: 780, left: 50, right: -50 },
        { ms: 3000, left: 100, right: 100 }
      ])
    );
    expect(sim.status).toBe('done');
    expect(cellAt(grid, sim.pose)).toBe('C4');
  });

  it('pen down draws, pen up does not; four "forward + turn 90°" close a square within 2 %', () => {
    const art = buildWorld(artFloor);
    const moves = square();
    const total = moves.reduce((t, m) => t + m.ms, 0);
    const drawn = runScripted(
      art,
      (r, t) => {
        r.setPen(true);
        timed(moves)(r, t);
      },
      { maxMs: total }
    );
    expect(drawn.strokes).toHaveLength(4); // one straight segment per side
    const gap = Math.hypot(drawn.pose.x - art.start.x, drawn.pose.y - art.start.y);
    expect(gap / (4 * 200)).toBeLessThan(0.02);
    const notDrawn = runScripted(art, timed(moves), { maxMs: total });
    expect(notDrawn.strokes).toHaveLength(0);
  });
});
