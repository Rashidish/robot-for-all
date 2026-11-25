import { describe, expect, it } from 'vitest';
import { portfolio, portfolioFileName, withClasses } from './children';

const thandi = {
  id: 'l1',
  nickname: 'Thandi R',
  grade: 4,
  avatar: 'rocket',
  language: 'zu',
  created_at: '2026-11-25T05:00:00Z'
};
const classes = [
  { learner_id: 'l1', class_id: 'c1', class_name: 'Grade 4B', organisation_name: 'Sizwe Primary' },
  { learner_id: 'l2', class_id: 'c1', class_name: 'Grade 4B', organisation_name: 'Sizwe Primary' }
];

describe("a parent's children", () => {
  it('pairs each child with their own classes', () => {
    expect(withClasses([thandi], classes)[0]?.classes).toEqual([classes[0]]);
  });

  it("the portfolio holds only this child's data, without internal ids", () => {
    const p = portfolio(
      thandi,
      {
        classes,
        consents: [
          {
            learner_id: 'l1',
            control: 'record',
            class_id: null,
            notice_version: '1.0',
            given_at: '2026-11-25T05:00:00Z',
            withdrawn_at: null
          }
        ],
        records: [
          { learner_id: 'l1', lesson_id: 'p1-crank-01', steps_done: 5 },
          { learner_id: 'l2', lesson_id: 'p1-gear-01', steps_done: 5 }
        ],
        badges: []
      },
      new Date('2026-11-25T06:00:00Z')
    );
    expect(p.child.nickname).toBe('Thandi R');
    expect(p.classes).toEqual([{ class: 'Grade 4B', school_or_club: 'Sizwe Primary' }]);
    expect(p.lesson_records).toEqual([{ lesson_id: 'p1-crank-01', steps_done: 5 }]);
    expect(JSON.stringify(p)).not.toContain('l2');
    expect(p.exported_at).toBe('2026-11-25T06:00:00.000Z');
  });

  it('makes a safe file name', () => {
    expect(portfolioFileName('Thandi R')).toBe('thandi-r-portfolio.json');
    expect(portfolioFileName('🚀')).toBe('child-portfolio.json');
  });
});
