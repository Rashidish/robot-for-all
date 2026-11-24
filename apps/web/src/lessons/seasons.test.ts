import { describe, expect, it } from 'vitest';
import { seasonProblems } from './seasons';

describe('seasons in the build (M4 spec FR-20)', () => {
  it('every season file is valid, has its artwork and names courses that exist', () => {
    expect(seasonProblems()).toEqual([]);
  });
});
