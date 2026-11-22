import { describe, expect, it } from 'vitest';
import { fromQuery, matches, toQuery } from './filter';

const crocodile = { grades: [3, 4], mechanism: 'lever', cost: 5 };
const gears = { grades: [5, 6, 7], mechanism: 'gear', cost: 10 };
const any = { grade: null, mechanism: null, maxCost: null };

describe('lesson filters', () => {
  it('shows everything with no filters', () => {
    expect([crocodile, gears].filter((l) => matches(l, any))).toHaveLength(2);
  });

  it('filters by grade, mechanism and cost together', () => {
    expect(matches(crocodile, { ...any, grade: 4 })).toBe(true);
    expect(matches(gears, { ...any, grade: 4 })).toBe(false);
    expect(matches(gears, { ...any, mechanism: 'gear', maxCost: 10 })).toBe(true);
    expect(matches(gears, { ...any, maxCost: 5 })).toBe(false);
  });

  it('reads and writes the address bar, ignoring bad values', () => {
    expect(fromQuery(new URLSearchParams('grade=4&mechanism=gear&cost=10'))).toEqual({
      grade: 4,
      mechanism: 'gear',
      maxCost: 10
    });
    expect(fromQuery(new URLSearchParams('grade=four&mechanism=<script>&cost=-1'))).toEqual(any);
    expect(toQuery({ grade: 5, mechanism: null, maxCost: 30 })).toBe('?grade=5&cost=30');
    expect(toQuery(any)).toBe('');
  });
});
