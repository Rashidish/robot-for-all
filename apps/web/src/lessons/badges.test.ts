import { describe, expect, it } from 'vitest';
import { allBadges, badgeArt, badgeProblems, liveBadges } from './badges';

const lessons = [
  { id: 'p1-lever-01', phase: 1, mechanism: 'lever' },
  { id: 'p1-lever-02', phase: 1, mechanism: 'lever' },
  { id: 'p1-crank-01', phase: 1, mechanism: 'crank' },
  { id: 'p1-cam-01', phase: 1, mechanism: 'cam' },
  { id: 'p1-gear-01', phase: 1, mechanism: 'gear' },
  { id: 'p1-wheel-01', phase: 1, mechanism: 'wheel and axle' },
  { id: 'p2-motor-01', phase: 2, mechanism: 'motor' },
  { id: 'p2-display-01', phase: 2, mechanism: 'display' },
  { id: 'p2-button-01', phase: 2, mechanism: 'buttons' }
];

describe('badge content (M5 FR-17)', () => {
  it('every badge file is right, with its picture and words', () => {
    expect(badgeProblems(lessons, [])).toEqual([]);
    expect(allBadges().length).toBeGreaterThanOrEqual(5);
  });

  it('badge pictures carry no words', () => {
    for (const b of allBadges()) expect(badgeArt(b.id)).not.toMatch(/<text[\s>]/);
  });

  it('only published badges go live; drafts show in the preview', () => {
    const drafts = allBadges().filter((b) => b.status !== 'published').length;
    expect(liveBadges(true).length - liveBadges(false).length).toBe(drafts);
  });
});
