import { describe, expect, it } from 'vitest';
import { checkBadge, earns, type LessonFacts, type LessonResult } from './badge';

const lessons: LessonFacts[] = [
  { id: 'p1-lever-01', phase: 1, mechanism: 'lever' },
  { id: 'p1-lever-02', phase: 1, mechanism: 'lever' },
  { id: 'p1-crank-01', phase: 1, mechanism: 'crank' },
  { id: 'p2-motor-01', phase: 2, mechanism: 'motor' }
];
const ok = {
  id: 'lever-master',
  rule: { kind: 'mechanism_done', mechanism: 'lever' },
  status: 'draft',
  ai_generated: true,
  reviewed_by: null
};
const r = (lesson: string, done = true, allYes = true): LessonResult => ({ lesson, done, allYes });

describe('badge files', () => {
  it('accepts a good badge and says what is wrong with a bad one', () => {
    expect(checkBadge(ok, lessons)).toEqual([]);
    const paths = (spec: unknown) => checkBadge(spec, lessons).map((p) => p.path);
    expect(paths({ ...ok, id: 'Lever Master' })).toContain('$.id');
    expect(paths({ ...ok, id: 'phase-1' })).toContain('$.id');
    expect(paths({ ...ok, status: 'published' })).toContain('$.reviewed_by');
    expect(paths({ ...ok, extra: 1 })).toContain('$.extra');
    expect(paths({ ...ok, rule: { kind: 'mechanism_done', mechanism: 'warp-drive' } })).toContain(
      '$.rule.mechanism'
    );
    expect(paths({ ...ok, rule: { kind: 'phase_done', phase: 2, count: 5 } })).toContain(
      '$.rule.count'
    );
    expect(paths({ ...ok, rule: { kind: 'lessons_done', count: 0 } })).toContain('$.rule.count');
    expect(paths({ ...ok, rule: { kind: 'magic' } })).toContain('$.rule.kind');
  });
});

describe('badge rules', () => {
  it('counts only done lessons; "Not yet" never counts', () => {
    expect(
      earns({ kind: 'lessons_done', count: 1 }, [r('p1-crank-01', false, false)], lessons)
    ).toBe(false);
    expect(earns({ kind: 'lessons_done', count: 1 }, [r('p1-crank-01')], lessons)).toBe(true);
    expect(earns({ kind: 'all_ican', count: 1 }, [r('p1-crank-01', false, true)], lessons)).toBe(
      true
    );
    expect(earns({ kind: 'all_ican', count: 1 }, [r('p1-crank-01', false, false)], lessons)).toBe(
      false
    );
  });

  it('phase and mechanism rules', () => {
    const results = [r('p1-lever-01'), r('p1-crank-01'), r('p2-motor-01')];
    expect(earns({ kind: 'phase_done', phase: 1, count: 2 }, results, lessons)).toBe(true);
    expect(earns({ kind: 'phase_done', phase: 1, count: 3 }, results, lessons)).toBe(false);
    expect(earns({ kind: 'mechanism_done', mechanism: 'lever' }, results, lessons)).toBe(false);
    expect(
      earns({ kind: 'mechanism_done', mechanism: 'lever' }, [...results, r('p1-lever-02')], lessons)
    ).toBe(true);
  });

  it('ignores lessons that are not published', () => {
    expect(earns({ kind: 'lessons_done', count: 1 }, [r('p1-gone-01')], lessons)).toBe(false);
  });
});
