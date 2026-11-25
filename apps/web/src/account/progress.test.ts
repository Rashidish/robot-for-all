import { describe, expect, it } from 'vitest';
import type { SheetSummary } from '../lessons/answers';
import { gridLessons, lessonTitle, phaseOf, type ProgressRecord, progressGrid } from './progress';

const sheets: Record<string, SheetSummary> = {
  'p1-crank-01-81feed': {
    lesson: 'p1-crank-01',
    lang: 'en',
    title: 'Crank rhino',
    sections: [
      { label: 'Predict', steps: 0 },
      { label: 'Run', steps: 2 }
    ],
    ican: ['I can turn a crank', 'I can explain an axle']
  },
  'p1-crank-01-zu-d55fee': {
    lesson: 'p1-crank-01',
    lang: 'zu',
    title: 'Ubhejane',
    sections: [],
    ican: []
  }
};
const rec = (over: Partial<ProgressRecord>): ProgressRecord => ({
  id: 'r1',
  learner_id: 'l1',
  lesson_id: 'p1-crank-01',
  sheet_code: 'p1-crank-01-81feed',
  steps_done: 4,
  i_can: [true, true],
  built_working: true,
  team_sheet: false,
  recorded_at: '2026-11-25T10:00:00Z',
  checked_at: null,
  revoked_at: null,
  ...over
});

describe('progress from answer sheets', () => {
  it('a full sheet is done; a "Not yet" names what to work on and is never done', () => {
    const done = progressGrid([rec({})], sheets)
      .get('l1')
      ?.get('p1-crank-01');
    expect(done).toMatchObject({ done: true, steps: 4, boxes: 4, notYet: [], checked: false });
    const notYet = progressGrid([rec({ i_can: [true, false] })], sheets)
      .get('l1')
      ?.get('p1-crank-01');
    expect(notYet?.done).toBe(false);
    expect(notYet?.notYet).toEqual(['I can explain an axle']);
    expect(
      progressGrid([rec({ steps_done: 3 })], sheets)
        .get('l1')
        ?.get('p1-crank-01')?.done
    ).toBe(false);
    expect(
      progressGrid([rec({ built_working: false })], sheets)
        .get('l1')
        ?.get('p1-crank-01')?.done
    ).toBe(false);
  });

  it('the newest record that is not revoked counts', () => {
    const grid = progressGrid(
      [
        rec({ id: 'old', recorded_at: '2026-11-20T10:00:00Z', i_can: [false, false] }),
        rec({ id: 'new', recorded_at: '2026-11-25T10:00:00Z', checked_at: '2026-11-25T11:00:00Z' }),
        rec({ id: 'bad', recorded_at: '2026-11-26T10:00:00Z', revoked_at: '2026-11-26T11:00:00Z' })
      ],
      sheets
    );
    expect(grid.get('l1')?.get('p1-crank-01')?.record.id).toBe('new');
    expect(grid.get('l1')?.get('p1-crank-01')?.checked).toBe(true);
  });

  it('lists lessons by phase and names them in the class’s language', () => {
    const grid = progressGrid(
      [rec({}), rec({ id: 'r2', lesson_id: 'p2-motor-01', sheet_code: 'unknown' })],
      sheets
    );
    expect(gridLessons(grid, null)).toEqual(['p1-crank-01', 'p2-motor-01']);
    expect(gridLessons(grid, 2)).toEqual(['p2-motor-01']);
    expect(phaseOf('p3-linemaze-01')).toBe(3);
    expect(lessonTitle('p1-crank-01', sheets, 'zu')).toBe('Ubhejane');
    expect(lessonTitle('p1-crank-01', sheets, 'xh')).toBe('Crank rhino');
    expect(lessonTitle('p2-motor-01', sheets)).toBe('p2-motor-01');
    // An unknown sheet code still shows, without a total.
    expect(grid.get('l1')?.get('p2-motor-01')?.boxes).toBeNull();
  });
});
