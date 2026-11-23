import { describe, expect, it } from 'vitest';
import boxAndBack from '../../../content/worlds/box-and-back.json';
import darkTunnel from '../../../content/worlds/dark-tunnel.json';
import followTheLine from '../../../content/worlds/follow-the-line.json';
import simpleMaze from '../../../content/worlds/simple-maze.json';
import { bumpBackTurnRight, lineFollower, robotReacts, timed } from '../test-support/drivers';
import { RADIUS_MM } from './robot';
import { type Driver, runScripted, Sim } from './sim';
import { buildWorld } from './world';

const forward: Driver = (r) => {
  r.setMotor('left', 100);
  r.setMotor('right', 100);
};

/** A plain floor with one wall, for bump and whisker tests. */
function wallWorld(
  bump: 'shake' | 'whiskers',
  wall = { x: 1000, y: 0, w: 10, h: 800 },
  heading = 0
) {
  return buildWorld({
    id: 'wall',
    version: 1,
    challenge: null,
    size: { w: 2000, h: 800 },
    walls: [wall],
    start: { x: 600, y: 400, heading },
    bump
  });
}

describe('launch worlds with scripted drivers', () => {
  it('"Robot that reacts" (one motor, light > 50) stops inside the dark tunnel', () => {
    const sim = runScripted(buildWorld(darkTunnel), robotReacts(50), { oneMotor: true });
    expect(sim.status).toBe('done');
    expect(sim.pose.x).toBeGreaterThan(1000);
    expect(sim.pose.x).toBeLessThan(1400);
    expect(sim.lightLevel()).toBe(20);
  });

  it('with the threshold below the tunnel light, the robot drives through and runs out of time', () => {
    const sim = runScripted(buildWorld(darkTunnel), robotReacts(10), { oneMotor: true });
    expect(sim.status).toBe('failed');
    expect(sim.reason).toBe('timeLimit');
    expect(sim.bumps).toBeGreaterThan(0); // it keeps bumping the far end
  });

  it('a two-sensor line follower finishes the line world', () => {
    const sim = runScripted(buildWorld(followTheLine), lineFollower(60));
    expect(sim.status).toBe('done');
  });

  it('forward 1 s, stop, backward 1 s, stop finishes the box-and-back world', () => {
    const sim = runScripted(
      buildWorld(boxAndBack),
      timed([
        { ms: 1000, left: 100, right: 100 },
        { ms: 500, left: 0, right: 0 },
        { ms: 1000, left: -100, right: -100 }
      ])
    );
    expect(sim.status).toBe('done');
    expect(sim.timeMs).toBeLessThan(3000);
  });

  it('driving forward 1 s and stopping is not enough: the robot must come back home', () => {
    const sim = runScripted(buildWorld(boxAndBack), timed([{ ms: 1000, left: 100, right: 100 }]));
    expect(sim.status).toBe('failed');
  });

  it('"bump, back up, turn right" gets out of the simple maze', () => {
    const sim = runScripted(buildWorld(simpleMaze), bumpBackTurnRight({ whiskers: false }));
    expect(sim.status).toBe('done');
    expect(sim.bumps).toBeGreaterThan(0);
  });
});

describe('walls and bumps', () => {
  it('bumping a wall gives a shake and stops the robot at the wall', () => {
    const sim = new Sim(wallWorld('shake'));
    sim.setMotor('left', 100);
    sim.setMotor('right', 100);
    sim.advance(1000);
    sim.advance(1000);
    sim.advance(1000);
    expect(sim.bumps).toBe(1);
    expect(sim.wasShaken()).toBe(true);
    expect(sim.wasShaken()).toBe(false); // the gesture is used up once read
    expect(sim.motorSpeeds).toEqual({ left: 0, right: 0 });
    expect(1000 - (sim.pose.x + RADIUS_MM)).toBeLessThan(5);
  });

  it('with whiskers, the robot stops against the wall with no shake, counting one touch', () => {
    const sim = runScripted(wallWorld('whiskers'), forward, { maxMs: 4000 });
    expect(sim.bumps).toBe(1);
    expect(sim.wasShaken()).toBe(false);
    expect(sim.motorSpeeds).toEqual({ left: 100, right: 100 });
    expect(1000 - (sim.pose.x + RADIUS_MM)).toBeLessThan(5);
    expect(sim.whisker('left')).toBe(true);
    expect(sim.whisker('right')).toBe(true);
  });

  it('the edge of the world is a wall too', () => {
    const sim = runScripted(wallWorld('shake', { x: 1990, y: 0, w: 10, h: 10 }, 180), forward, {
      maxMs: 4000
    });
    expect(sim.bumps).toBe(1);
    expect(sim.pose.x).toBeCloseTo(RADIUS_MM, -1);
  });

  it('slides along a wall it meets at an angle instead of sticking', () => {
    const sim = runScripted(wallWorld('whiskers', { x: 0, y: 100, w: 2000, h: 10 }, 330), forward, {
      maxMs: 4000
    });
    expect(sim.bumps).toBe(1);
    expect(sim.pose.x).toBeGreaterThan(1200);
  });

  it('noBumps: a bump fails the challenge', () => {
    const world = buildWorld({ ...simpleMaze, noBumps: true });
    const sim = runScripted(world, bumpBackTurnRight({ whiskers: false }));
    expect(sim.status).toBe('failed');
    expect(sim.reason).toBe('bumped');
  });
});

describe('whiskers (FR-15)', () => {
  /** Drive forward until a whisker is pressed; return both whiskers at that moment. */
  function firstTouch(world: ReturnType<typeof wallWorld>) {
    const sim = new Sim(world);
    for (let i = 0; i < 500; i++) {
      sim.step(forward);
      if (sim.whisker('left') || sim.whisker('right')) break;
    }
    return { left: sim.whisker('left'), right: sim.whisker('right'), sim };
  }

  it('driving straight at a wall in front of one whisker presses that whisker only', () => {
    // A short wall ahead and to the left (smaller y) of the robot's path.
    const left = firstTouch(wallWorld('whiskers', { x: 1000, y: 300, w: 10, h: 80 }));
    expect(left).toMatchObject({ left: true, right: false });
    const right = firstTouch(wallWorld('whiskers', { x: 1000, y: 420, w: 10, h: 80 }));
    expect(right).toMatchObject({ left: false, right: true });
  });

  it('driving straight into a long wall presses both whiskers', () => {
    expect(firstTouch(wallWorld('whiskers'))).toMatchObject({ left: true, right: true });
  });

  it('driving at an angle presses only the near whisker', () => {
    // Heading 20° (clockwise, towards +y): the left whisker is nearer the wall ahead.
    expect(firstTouch(wallWorld('whiskers', undefined, 20))).toMatchObject({
      left: true,
      right: false
    });
    expect(firstTouch(wallWorld('whiskers', undefined, 340))).toMatchObject({
      left: false,
      right: true
    });
  });

  it('a whisker lets go when contact ends', () => {
    const { sim } = firstTouch(wallWorld('whiskers'));
    sim.advance(1000, (r) => {
      r.setMotor('left', -100);
      r.setMotor('right', -100);
    });
    expect(sim.whisker('left')).toBe(false);
    expect(sim.whisker('right')).toBe(false);
  });
});

describe('run report (§6.1)', () => {
  const tunnel = buildWorld(darkTunnel);

  it('has the agreed fields, in a fixed order, with no personal data', () => {
    const r = runScripted(tunnel, robotReacts(50), { oneMotor: true }).report('abc123');
    expect(Object.keys(r)).toEqual([
      'sim',
      'worldId',
      'worldVersion',
      'worldHash',
      'programHash',
      'status',
      'timeMs',
      'bumps',
      'distance',
      'realFloor',
      'seed',
      'oneMotor'
    ]);
    expect(r).toMatchObject({
      sim: 'rfa-sim/1',
      worldId: 'dark-tunnel',
      status: 'done',
      bumps: 0,
      seed: 0
    });
    expect(JSON.stringify(r).length).toBeLessThan(300);
  });

  it('a failed run says why, right after the status', () => {
    const r = runScripted(tunnel, robotReacts(10), { oneMotor: true }).report('p');
    expect(Object.keys(r).slice(5, 8)).toEqual(['status', 'reason', 'timeMs']);
    expect(r.reason).toBe('timeLimit');
  });

  it('the same run gives a byte-identical report, with and without "real floor"', () => {
    for (const realFloor of [false, true]) {
      const a = JSON.stringify(
        runScripted(buildWorld(simpleMaze), bumpBackTurnRight({ whiskers: false }), {
          realFloor,
          seed: 42
        }).report('p')
      );
      const b = JSON.stringify(
        runScripted(buildWorld(simpleMaze), bumpBackTurnRight({ whiskers: false }), {
          realFloor,
          seed: 42
        }).report('p')
      );
      expect(a).toBe(b);
    }
  });

  it('"real floor" makes a straight drive drift, the same way for the same seed', () => {
    const open = {
      id: 'open',
      version: 1,
      challenge: null,
      size: { w: 3000, h: 3000 },
      start: { x: 200, y: 1500, heading: 0 }
    };
    const drift = (seed: number) =>
      runScripted(buildWorld(open), forward, { realFloor: true, seed, maxMs: 5000 }).pose.y;
    expect(Math.abs(drift(1) - 1500)).toBeGreaterThan(1);
    expect(drift(1)).toBe(drift(1));
    expect(drift(1)).not.toBe(drift(2));
    expect(runScripted(buildWorld(open), forward, { maxMs: 5000 }).pose.y).toBeCloseTo(1500, 6);
  });

  it('Stop by the learner ends the run with status "running"', () => {
    const sim = new Sim(tunnel);
    sim.advance(500, forward);
    sim.stop();
    sim.advance(500, forward);
    expect(sim.timeMs).toBe(500);
    expect(sim.report('p').status).toBe('running');
  });
});

describe('pen', () => {
  it('draws while down and not while up', () => {
    const world = buildWorld({
      id: 'art',
      version: 1,
      challenge: null,
      size: { w: 2000, h: 2000 },
      start: { x: 1000, y: 1000, heading: 0 }
    });
    const sim = new Sim(world);
    sim.setPen(true);
    sim.advance(1000, forward);
    sim.setPen(false);
    sim.advance(1000, forward);
    expect(sim.strokes).toHaveLength(1); // a straight line is kept as one segment
    const [x1, , x2] = sim.strokes[0] ?? [0, 0, 0];
    expect(x2 - x1).toBeCloseTo(200, 0);
  });
});
