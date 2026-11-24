import { describe, expect, it } from 'vitest';
import { buildSeason, checkSeason, saDate, seasonOf, seasonState } from './season';

const worlds = new Set(['a-junior', 'a-middle', 'a-senior', 'other']);
const good = {
  id: 'rhino-patrol',
  number: 1,
  from: '2027-01-15',
  to: '2027-12-10',
  courses: { 'grade-3-4': 'a-junior', 'grade-5-6': 'a-middle', 'grade-7-9': 'a-senior' }
};

describe('seasons (M4 spec FR-20)', () => {
  it('accepts a good season and names its texts after its id', () => {
    expect(checkSeason(good, worlds)).toEqual([]);
    const s = buildSeason(good, worlds);
    expect(s.name).toBe('season_rhino_patrol_name');
    expect(s.about).toBe('season_rhino_patrol_about');
  });

  it.each([
    ['a bad id', { ...good, id: 'Season 1' }, '$.id'],
    ['number 0', { ...good, number: 0 }, '$.number'],
    ['a bad date', { ...good, from: '15/01/2027' }, '$.from'],
    ['an end before the start', { ...good, to: '2026-12-31' }, '$.to'],
    [
      'a missing grade band',
      { ...good, courses: { 'grade-3-4': 'a-junior' } },
      '$.courses.grade-5-6'
    ],
    [
      'an unknown course',
      { ...good, courses: { ...good.courses, 'grade-7-9': 'nowhere' } },
      '$.courses.grade-7-9'
    ],
    [
      'an unknown grade band',
      { ...good, courses: { ...good.courses, 'grade-1-2': 'other' } },
      '$.courses.grade-1-2'
    ],
    ['an unknown field', { ...good, colour: 'green' }, '$.colour']
  ])('reports %s', (_name, spec, path) => {
    expect(checkSeason(spec, worlds).map((p) => p.path)).toContain(path);
    expect(() => buildSeason(spec, worlds)).toThrow();
  });

  it('is upcoming, current or past by South African date', () => {
    const s = buildSeason(good, worlds);
    expect(seasonState(s, '2027-01-14')).toBe('upcoming');
    expect(seasonState(s, '2027-01-15')).toBe('current');
    expect(seasonState(s, '2027-12-10')).toBe('current');
    expect(seasonState(s, '2027-12-11')).toBe('past');
    // 23:00 UTC on 14 January is already 15 January in South Africa.
    expect(saDate(new Date('2027-01-14T23:00:00Z'))).toBe('2027-01-15');
  });

  it('finds the season a course belongs to', () => {
    const s = buildSeason(good, worlds);
    expect(seasonOf([s], 'a-senior')?.id).toBe('rhino-patrol');
    expect(seasonOf([s], 'other')).toBeUndefined();
  });
});
