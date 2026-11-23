import { describe, expect, it } from 'vitest';
import { type Driver, runScripted } from './sim';
import { buildWorld } from './world';

const drive =
  (left: number, right: number): Driver =>
  (r) => {
    r.setMotor('left', left);
    r.setMotor('right', right);
  };

describe('missions and scoring (FR-17)', () => {
  // A 4×1 strip: home in A1, a waterhole in C1, a gate flap on the far (east) edge of D1.
  const course = buildWorld({
    id: 'strip',
    version: 1,
    challenge: null,
    grid: { cols: 4, rows: 1 },
    pieces: [{ piece: 'target', id: 'gate', cell: 'D1', edge: 'E' }],
    areas: [
      { id: 'home', cell: 'A1' },
      { id: 'waterhole', cell: 'C1' }
    ],
    start: { cell: 'A1', heading: 0 },
    bump: 'whiskers',
    missions: [
      { id: 'gate', type: 'touchTarget', target: 'gate', points: 30 },
      { id: 'waterhole', type: 'stopInZone', zone: 'waterhole', points: 40 },
      { id: 'home', type: 'returnHome', zone: 'home', points: 20 }
    ],
    scoring: { timeBonus: 30, wallTouch: -5 },
    timeLimitMs: 60000
  });

  it('a run that completes two of three missions gets exactly their points, the time bonus and the wall-touch penalty', () => {
    let phase = 0;
    const driver: Driver = (r, t) => {
      if (phase === 0 && t >= 500) phase = 1; // back into the wall behind: one wall touch
      if (phase === 1 && (r.whisker('left') || r.whisker('right'))) phase = 2; // touched the gate
      drive(
        ...([
          [-100, -100],
          [100, 100],
          [-100, -100]
        ][phase] as [number, number])
      )(r, t);
    };
    const sim = runScripted(course, driver);
    const r = sim.report('p');
    expect(r.status).toBe('done'); // returning home ends the round
    expect(r.missions).toEqual({ gate: 1, waterhole: 0, home: 1 });
    expect(r.bumps).toBe(1);
    const bonus = Math.round((30 * (60000 - r.timeMs)) / 60000);
    expect(bonus).toBeGreaterThan(20);
    expect(r.score).toBe(30 + 20 + bonus - 5);
    expect(Object.keys(r).slice(-2)).toEqual(['score', 'missions']);
  });

  it('driving through a stop zone is not stopping in it; stopping is', () => {
    const through = runScripted(course, drive(100, 100), { maxMs: 2500 });
    expect(through.missionDone('waterhole')).toBe(false);
    // Drive 2.2 s (to x ≈ 540, inside C1), then stop.
    const sim = runScripted(course, (r, t) => (t < 2200 ? drive(100, 100)(r, t) : r.stopMotors()), {
      maxMs: 3000
    });
    expect(sim.missionDone('waterhole')).toBe(true);
  });

  it('no time bonus when time runs out; the score never goes below 0', () => {
    const sim = runScripted(course, drive(-100, -100));
    expect(sim.status).toBe('failed');
    expect(sim.report('p')).toMatchObject({
      reason: 'timeLimit',
      score: 0,
      missions: { gate: 0, waterhole: 0, home: 0 }
    });
  });

  it('home only counts after leaving it and doing another mission', () => {
    const sim = runScripted(course, drive(0, 0), { maxMs: 2000 });
    expect(sim.missionDone('home')).toBe(false);
  });

  it('checkpoints must be visited in order; a tunnel counts once the robot comes out of it', () => {
    const strip = (zones: string[]) =>
      buildWorld({
        id: 'strip',
        version: 1,
        challenge: null,
        grid: { cols: 5, rows: 1 },
        pieces: [{ piece: 'tunnel', id: 'thicket', cell: 'B1', dir: 'ew' }],
        areas: [
          { id: 'post-a', cell: 'C1' },
          { id: 'post-b', cell: 'D1' }
        ],
        start: { cell: 'A1', heading: 0 },
        missions: [
          { id: 'thicket', type: 'passTunnel', tunnel: 'thicket', points: 10 },
          { id: 'patrol', type: 'checkpoints', zones, points: 10 }
        ]
      });
    const inOrder = runScripted(strip(['post-a', 'post-b']), drive(100, 100), { maxMs: 5000 });
    expect(inOrder.status).toBe('done');
    expect(inOrder.report('p').score).toBe(20);
    const wrongOrder = runScripted(strip(['post-b', 'post-a']), drive(100, 100), { maxMs: 5000 });
    expect(wrongOrder.missionDone('thicket')).toBe(true);
    expect(wrongOrder.missionDone('patrol')).toBe(false);
  });
});
