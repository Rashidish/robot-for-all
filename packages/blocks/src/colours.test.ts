import { describe, expect, it } from 'vitest';
import { CATEGORY_COLOURS, contrastWithWhite } from './colours';

describe('block colours', () => {
  it('give white block text at least 4.5:1 contrast (WCAG AA)', () => {
    for (const [category, colour] of Object.entries(CATEGORY_COLOURS)) {
      expect(contrastWithWhite(colour), category).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('measures contrast correctly', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 0);
    expect(contrastWithWhite('#1E90FF')).toBeLessThan(4.5);
  });
});
