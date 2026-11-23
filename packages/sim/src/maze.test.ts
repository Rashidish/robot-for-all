import { describe, expect, it } from 'vitest';
import { generateMaze, mazePathLength } from './maze';

describe('seeded mazes (FR-18)', () => {
  it('the same maze number and size give the same maze', () => {
    for (const size of [3, 4, 5, 6]) {
      expect(generateMaze(4817, size)).toEqual(generateMaze(4817, size));
    }
    expect(generateMaze(1, 4)).not.toEqual(generateMaze(2, 4));
  });

  it('1,000 random mazes are all solvable from start to finish', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const m = generateMaze(seed, 3 + (seed % 4));
      expect(mazePathLength(m)).toBeGreaterThan(0);
    }
  });

  it('is a perfect maze: exactly one path between any two cells (cells − 1 openings)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const m = generateMaze(seed, 5);
      const openings = [...m.openEast, ...m.openSouth].filter(Boolean).length;
      expect(openings).toBe(5 * 5 - 1);
    }
  });

  it('makes a 6×6 maze in under 5 ms', () => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) generateMaze(i, 6);
    expect((performance.now() - t) / 100).toBeLessThan(5);
  });

  it('rejects sizes outside 3–6 and bad maze numbers', () => {
    expect(() => generateMaze(1, 2)).toThrow(RangeError);
    expect(() => generateMaze(1, 7)).toThrow(RangeError);
    expect(() => generateMaze(-1, 4)).toThrow(RangeError);
    expect(() => generateMaze(1.5, 4)).toThrow(RangeError);
  });
});
