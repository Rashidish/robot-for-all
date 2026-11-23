import { describe, expect, it } from 'vitest';
import { worldIds, worldProblems } from './worlds';

describe('robot worlds in the build (M4 spec FR-4)', () => {
  it('every world file in content/worlds is valid and named after its id', () => {
    expect(worldProblems()).toEqual([]);
  });

  it('knows every world id, for lessons to point to', () => {
    const ids = worldIds();
    for (const id of ['open-floor', 'dark-tunnel', 'box-and-back', 'bump-maze', 'rhino-patrol']) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
