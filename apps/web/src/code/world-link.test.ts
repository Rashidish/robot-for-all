import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import darkTunnel from '../../../../content/worlds/dark-tunnel.json';
import simpleMaze from '../../../../content/worlds/simple-maze.json';
import { buildWorld, replay } from '../../../../packages/sim/src/index';
import {
  GRAPH_SAMPLES,
  graphRange,
  gridFor,
  loadReports,
  monitorSample,
  squareAt,
  loadWorlds,
  missionList,
  specsById,
  withMaze,
  PUSH_EVERY_MS,
  REPORTS_KEY,
  saveReport,
  usesRightMotor,
  WorldLink
} from './world-link';

const LEFT_ONLY = 'import rfa_robot\nrfa_robot.motor("left", 100)\n';
const TWO_MOTORS = 'import rfa_robot\nrfa_robot.motor("left", 100)\nrfa_robot.motor("right", 50)\n';

describe('world link (M4 step 2)', () => {
  it('a program that never drives the right motor is a one-motor cart', () => {
    expect(usesRightMotor(LEFT_ONLY)).toBe(false);
    expect(usesRightMotor(TWO_MOTORS)).toBe(true);
    // One motor: both wheels follow it, so the cart drives straight.
    const one = new WorldLink(buildWorld(darkTunnel), LEFT_ONLY);
    one.call({ call: 'motor_left', value: 100 });
    for (let i = 0; i < 50; i++) one.tick(20);
    expect(one.sim.pose.y).toBeCloseTo(400, 6);
    expect(one.report().oneMotor).toBe(true);
  });

  it('robot calls drive the world; "Robot that reacts" stops in the tunnel', () => {
    const link = new WorldLink(buildWorld(darkTunnel), LEFT_ONLY);
    let light = 255;
    for (let t = 0; t < 10_000 && link.sim.status === 'running'; t += 20) {
      // The program on the micro:bit sees the light level the world pushed (every 100 ms).
      if (t % 100 === 0)
        link.call(light > 50 ? { call: 'motor_left', value: 100 } : { call: 'stop', value: 0 });
      const p = link.tick(20);
      if (p.light !== undefined) light = p.light;
    }
    expect(link.report().status).toBe('done');
  });

  it('pushes sensors when they change and at least every 100 ms', () => {
    const link = new WorldLink(buildWorld(darkTunnel), LEFT_ONLY);
    const pushed: number[] = [];
    for (let t = 0; t < 1000; t += 20) if (link.tick(20).sensors) pushed.push(t);
    expect(pushed[0]).toBe(0);
    const gaps = pushed.slice(1).map((t, i) => t - (pushed[i] ?? 0));
    expect(Math.max(...gaps)).toBeLessThanOrEqual(PUSH_EVERY_MS);
  });

  it('a bump in a "shake" world becomes a shake for the micro:bit', () => {
    const link = new WorldLink(buildWorld(simpleMaze), LEFT_ONLY);
    link.call({ call: 'motor_left', value: 100 });
    let shakes = 0;
    for (let t = 0; t < 10_000; t += 20) if (link.tick(20).shake) shakes++;
    expect(shakes).toBe(1);
  });

  it('keeps the latest run report per world on this device only', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v)
    };
    const link = new WorldLink(buildWorld(darkTunnel), LEFT_ONLY);
    saveReport(storage, link.report());
    expect(Object.keys(loadReports(storage))).toEqual(['dark-tunnel']);
    expect(loadReports(storage)['dark-tunnel']?.programHash).toMatch(/^[0-9a-f]{8}$/);
    data.set(REPORTS_KEY, 'not json');
    expect(loadReports(storage)).toEqual({});
    expect(() => saveReport(undefined, link.report())).not.toThrow();
  });

  it('loads every world in content/worlds, launch worlds first', () => {
    const dir = new URL('../../../../content/worlds/', import.meta.url);
    const specs = Object.fromEntries(
      readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as unknown])
    );
    const ids = loadWorlds(specs).map((w) => w.id);
    expect(ids.slice(0, 5)).toEqual([
      'open-floor',
      'dark-tunnel',
      'box-and-back',
      'follow-the-line',
      'simple-maze'
    ]);
    expect(ids).toHaveLength(Object.keys(specs).length);
  });
});

describe('Monitor and grid (FR-11, FR-12)', () => {
  it('samples motor speeds, light, sensors and pen', () => {
    const link = new WorldLink(buildWorld(darkTunnel), TWO_MOTORS);
    link.call({ call: 'motor_left', value: 60 });
    link.call({ call: 'motor_right', value: -30 });
    link.call({ call: 'pen', value: 1 });
    link.tick(20);
    expect(monitorSample(link.sim)).toEqual({
      motor_left: 60,
      motor_right: -30,
      light: 200,
      line_left: 0,
      line_right: 0,
      whisker_left: 0,
      whisker_right: 0,
      pen: 1
    });
    expect(graphRange('light')).toEqual([0, 255]);
    expect(GRAPH_SAMPLES).toBe(50);
  });

  it('names the right square at each corner and the centre', () => {
    const world = buildWorld(darkTunnel); // 2000 × 800 mm, no grid of its own: 10 × 4 squares
    expect(gridFor(world)).toEqual({ cols: 10, rows: 4, cell: 200 });
    expect(squareAt(world, 0, 0)).toBe('A1');
    expect(squareAt(world, 1999, 0)).toBe('J1');
    expect(squareAt(world, 0, 799)).toBe('A4');
    expect(squareAt(world, 1999, 799)).toBe('J4');
    expect(squareAt(world, 1000, 400)).toBe('F3');
    expect(squareAt(world, 2000, 800)).toBe('J4'); // the far edge belongs to the last square
  });
});

describe('missions and maze numbers (FR-17, FR-18)', () => {
  const dir = new URL('../../../../content/worlds/', import.meta.url);
  const specs = Object.fromEntries(
    readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as unknown])
  );

  it('a maze course rebuilt with a maze number gives the same maze every time', () => {
    const spec = specsById(specs)['bump-maze'];
    const a = withMaze(spec, 4817, 5);
    expect(a.maze).toEqual({ kind: 'walls', size: 5, seed: 4817 });
    expect(withMaze(spec, 4817, 5)).toEqual(a);
    expect(withMaze(spec, 4818, 5)).not.toEqual(a);
    // Out-of-range input is clamped, never an error for the learner.
    expect(withMaze(spec, -3, 9).maze).toEqual({ kind: 'walls', size: 6, seed: 0 });
  });

  it('lists the missions and ticks them off as they are done', () => {
    const link = new WorldLink(buildWorld(specsById(specs)['line-maze']), TWO_MOTORS);
    expect(missionList(link.sim)).toEqual([{ id: 'finish', points: 100, done: false }]);
    expect(missionList(new WorldLink(buildWorld(darkTunnel), LEFT_ONLY).sim)).toEqual([]);
  });
});

describe('replaying a run from the editor (FR-14)', () => {
  it('the calls the link recorded replay to a byte-identical run report', () => {
    const world = buildWorld(darkTunnel);
    const link = new WorldLink(world, LEFT_ONLY);
    let light = 255;
    for (let t = 0; t < 10_000 && link.sim.status === 'running'; t += 20) {
      if (t % 100 === 0) {
        link.call(light > 50 ? { call: 'motor_left', value: 100 } : { call: 'stop', value: 0 });
      }
      const p = link.tick(20);
      if (p.light !== undefined) light = p.light;
    }
    const again = replay(world, link.calls, { oneMotor: true });
    expect(JSON.stringify(again.report(link.programHash))).toBe(JSON.stringify(link.report()));
  });
});
