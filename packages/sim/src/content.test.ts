// Every world and course in content/worlds is valid, has its texts, and can be finished.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../../content/i18n/en.json';
import { bumpMaze, leftHandLineMaze } from '../test-support/drivers';
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
  it('has the five launch worlds and the five first courses', () => {
    expect(files.sort()).toEqual(
      [
        'box-and-back',
        'bump-maze',
        'dark-tunnel',
        'follow-the-line',
        'grid-delivery',
        'line-junction',
        'line-maze',
        'open-floor',
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
