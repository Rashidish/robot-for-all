// Every world and course in content/worlds is valid, has its texts, and can be finished.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../../content/i18n/en.json';
import { bumpMaze, leftHandLineMaze, timed } from '../test-support/drivers';
import { runScripted } from './sim';
import { buildWorld, checkWorld } from './world';

const dir = join(import.meta.dirname, '../../../content/worlds');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const specs = files.map((f) => ({
  file: f,
  spec: JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>
}));
const messages = en as Record<string, string>;
const key = (id: unknown) => String(id).replaceAll('-', '_');

describe('content/worlds', () => {
  it('has the seven launch worlds, the first courses and the Season 1 courses', () => {
    // Sorted as file names: "rhino-patrol-…" comes before "rhino-patrol.json".
    expect(files.sort()).toEqual(
      [
        'art-floor',
        'box-and-back',
        'bump-maze',
        'dark-tunnel',
        'follow-the-line',
        'grid-delivery',
        'grid-map',
        'line-junction',
        'line-maze',
        'open-floor',
        'rhino-patrol-junior',
        'rhino-patrol-senior',
        'rhino-patrol',
        'simple-maze'
      ].map((id) => `${id}.json`)
    );
  });

  it.each(specs)('$file is valid and named after its id', ({ file, spec }) => {
    expect(checkWorld(spec)).toEqual([]);
    expect(file).toBe(`${String(spec.id)}.json`);
  });

  it.each(specs)('$file has its challenge and mission texts in English', ({ spec }) => {
    expect(spec.challenge).toBe(`world_${key(spec.id)}_challenge`);
    expect(messages[spec.challenge as string]).toBeTruthy();
    for (const m of (spec.missions ?? []) as { id: string }[]) {
      expect(messages[`mission_${key(spec.id)}_${key(m.id)}`], m.id).toBeTruthy();
    }
  });
});

describe('random maze courses can be finished within their time limit', () => {
  const load = (id: string) => specs.find((s) => s.spec.id === id)?.spec ?? {};

  it('"bump, back up, turn right" (curving left while driving) escapes 100 sample 4×4 wall mazes', () => {
    const course = load('bump-maze');
    const slowest = { seed: 0, ms: 0 };
    for (let seed = 1; seed <= 100; seed++) {
      const sim = runScripted(buildWorld(course, { seed }), bumpMaze());
      expect(sim.status, `maze ${seed}`).toBe('done');
      if (sim.timeMs > slowest.ms) Object.assign(slowest, { seed, ms: sim.timeMs });
    }
    expect(slowest.ms).toBeLessThan(course.timeLimitMs as number);
  });

  it('a left-hand line-maze driver with two line sensors finishes 100 sample 4×4 line mazes', () => {
    const course = load('line-maze');
    for (let seed = 1; seed <= 100; seed++) {
      const sim = runScripted(buildWorld(course, { seed }), leftHandLineMaze());
      expect(sim.status, `maze ${seed}`).toBe('done');
    }
  });
});

describe('Season 1 "Rhino Patrol": every mission can be done within the time limit', () => {
  const load = (id: string) => buildWorld(specs.find((s) => s.spec.id === id)?.spec ?? {});
  // A planned run with timed moves: forward or back by mm at speed 60 (120 mm/s), quarter
  // turns on the spot (about 654 ms), and a pause. Learners' sensor programs take other paths.
  type Move = { ms: number; left: number; right: number };
  const F = (mm: number): Move => ({
    ms: Math.round((Math.abs(mm) / 120) * 1000),
    left: Math.sign(mm) * 60,
    right: Math.sign(mm) * 60
  });
  const L: Move = { ms: 654, left: -60, right: 60 };
  const R: Move = { ms: 654, left: 60, right: -60 };
  const pause: Move = { ms: 500, left: 0, right: 0 };

  it.each([
    // Grade 3–4: timed moves only, no sensors.
    ['rhino-patrol-junior', [F(400), pause, F(200), L, F(400), L, F(600), L, F(400)], 145],
    // Grade 5–6: up the fence line, through the thicket, touch the gate, waterhole, home.
    [
      'rhino-patrol',
      [F(600), R, F(800), R, F(680), F(-80), R, F(400), R, F(200), pause, L, F(400), L, F(200)],
      177
    ],
    // Grade 7–9: three posts in order, thicket, gate, the walled waterhole, home.
    [
      'rhino-patrol-senior',
      [
        F(800),
        L,
        F(1000),
        L,
        F(800),
        L,
        F(440),
        F(-40),
        L,
        F(400),
        pause,
        F(-200),
        R,
        F(600),
        R,
        F(200)
      ],
      190
    ]
  ] as const)('%s', (id, moves, score) => {
    const world = load(id);
    const sim = runScripted(world, timed([...moves]));
    expect(sim.status).toBe('done');
    for (const m of world.missions) expect(sim.missionDone(m.id), m.id).toBe(true);
    expect(sim.timeMs).toBeLessThan(world.timeLimitMs ?? 120_000);
    expect(sim.report('planned').score).toBe(score);
  });
});
