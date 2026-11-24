import { describe, expect, it } from 'vitest';
import { BANNER_CLOSED_KEY, saToday, setupBanner } from './banner';

function fakeBanner(from: string, to: string, id = 'b1') {
  let onClick: (() => void) | null = null;
  const el = {
    hidden: true,
    dataset: { from, to, id },
    querySelector: () => ({ addEventListener: (_: string, fn: () => void) => (onClick = fn) })
  };
  return { el, close: () => onClick?.() };
}
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v)
  };
};

describe('announcement banner (back-office spec §6.7)', () => {
  it('shows only from its first to its last day, by South African date', () => {
    const b = fakeBanner('2027-01-06', '2027-01-13');
    setupBanner(b.el, new Date('2027-01-05T21:00:00Z'), memory()); // 23:00 on the 5th in SA
    expect(b.el.hidden).toBe(true);
    setupBanner(b.el, new Date('2027-01-05T22:30:00Z'), memory()); // 00:30 on the 6th in SA
    expect(b.el.hidden).toBe(false);
    setupBanner(b.el, new Date('2027-01-13T12:00:00Z'), memory());
    expect(b.el.hidden).toBe(false);
    setupBanner(b.el, new Date('2027-01-14T00:00:00Z'), memory());
    expect(b.el.hidden).toBe(true);
    expect(saToday(new Date('2027-01-13T22:00:00Z'))).toBe('2027-01-14');
  });

  it('stays closed once closed, but a new banner shows again', () => {
    const store = memory();
    const first = fakeBanner('2027-01-06', '2027-01-13', 'one');
    setupBanner(first.el, new Date('2027-01-08T08:00:00Z'), store);
    first.close();
    expect(first.el.hidden).toBe(true);
    expect(store.getItem(BANNER_CLOSED_KEY)).toBe('one');
    setupBanner(first.el, new Date('2027-01-09T08:00:00Z'), store);
    expect(first.el.hidden).toBe(true);
    const next = fakeBanner('2027-01-06', '2027-01-13', 'two');
    setupBanner(next.el, new Date('2027-01-09T08:00:00Z'), store);
    expect(next.el.hidden).toBe(false);
  });

  it('works when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };
    const b = fakeBanner('2027-01-06', '2027-01-13');
    setupBanner(b.el, new Date('2027-01-08T08:00:00Z'), blocked);
    expect(b.el.hidden).toBe(false);
    b.close();
    expect(b.el.hidden).toBe(true);
    setupBanner(b.el, new Date('2027-01-08T08:00:00Z'), null);
    expect(b.el.hidden).toBe(false);
  });
});
