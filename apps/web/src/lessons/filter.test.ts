import { describe, expect, it } from 'vitest';
import { fromQuery, matches, toQuery } from './filter';

const crocodile = { grades: [3, 4], mechanism: 'lever', cost: 5, machines: [] };
const gears = {
  grades: [5, 6, 7],
  mechanism: 'gear',
  cost: 10,
  machines: ['gear-train', 'bushing']
};
const any = { grade: null, mechanism: null, maxCost: null, machine: null };

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

  it('filters by a Machines topic the lesson uses (machines spec FR-13)', () => {
    expect(matches(gears, { ...any, machine: 'bushing' })).toBe(true);
    expect(matches(crocodile, { ...any, machine: 'bushing' })).toBe(false);
  });

  it('reads and writes the address bar, ignoring bad values', () => {
    expect(
      fromQuery(new URLSearchParams('grade=4&mechanism=gear&cost=10&machine=gear-train'))
    ).toEqual({
      grade: 4,
      mechanism: 'gear',
      maxCost: 10,
      machine: 'gear-train'
    });
    expect(
      fromQuery(new URLSearchParams('grade=four&mechanism=<script>&cost=-1&machine=x"y'))
    ).toEqual(any);
    expect(toQuery({ grade: 5, mechanism: null, maxCost: 30, machine: 'crank' })).toBe(
      '?grade=5&cost=30&machine=crank'
    );
    expect(toQuery(any)).toBe('');
  });
});
