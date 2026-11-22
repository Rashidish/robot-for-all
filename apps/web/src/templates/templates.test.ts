// Every template sheet in content/ must render, fit A4 and stay small enough for cheap data.
import { describe, expect, it } from 'vitest';
import { templates, templateSvg } from './load';

describe('template sheets in content/projects', () => {
  it('there is at least one', () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  for (const entry of templates) {
    describe(`${entry.lesson}/${entry.name}`, () => {
      const svg = templateSvg(entry);

      it('renders true-scale A4 with the 50 mm check square', () => {
        expect(svg).toContain('width="210mm" height="297mm"');
        expect(svg).toMatch(/width="50" height="50"/);
      });

      it('is at most 80 KB', () => {
        expect(new TextEncoder().encode(svg).length).toBeLessThanOrEqual(80 * 1024);
      });
    });
  }
});
