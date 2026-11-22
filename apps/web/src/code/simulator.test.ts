// The on-screen micro:bit is served from /simulator/<upstream>-<build>/ with a year-long cache
// (ADR-0006). If our patches or build scripts change, the folder must change too, or learners'
// browsers keep running the old copy. This test fails until the build number is bumped.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import simulator from '../../simulator.json';

const root = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));

describe('on-screen micro:bit build', () => {
  it('has a new build number whenever its patches or build scripts change', () => {
    const patches = readdirSync(new URL('patches/simulator/', root))
      .filter((f) => f.endsWith('.patch'))
      .sort()
      .map((f) => read(`patches/simulator/${f}`));
    const hash = createHash('sha256');
    for (const part of [...patches, read('scripts/build-simulator.sh'), read('scripts/vendor-simulator.mjs')]) {
      hash.update(part);
    }
    const now = hash.digest('hex').slice(0, 16);
    expect(
      simulator.sourceHash,
      `The simulator's patches or scripts changed: bump "build" in apps/web/simulator.json and set "sourceHash" to ${now}`
    ).toBe(now);
  });
});
