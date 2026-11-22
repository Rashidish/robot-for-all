import { describe, expect, it } from 'vitest';
import {
  A4,
  cam,
  CHECK_SQUARE,
  disc,
  gear,
  gearCentreDistance,
  layout,
  MARGIN,
  measurements,
  renderSheet,
  shape,
  strip,
  wrap
} from './index';

const labels = { checkSquare: 'This square should measure 50 mm.', key: 'Cut solid lines.' };

describe('parts are drawn to size in millimetres', () => {
  it('strip: size and evenly spaced holes', () => {
    const s = strip({ name: 'Arm', length: 120, width: 15, holes: 3 });
    expect([s.width, s.height]).toEqual([120, 15]);
    expect(s.holes.map((h) => h.x)).toEqual([7.5, 60, 112.5]);
    expect(s.holes.every((h) => h.y === 7.5)).toBe(true);
  });

  it('disc: centre axle and crank holes at the given offsets', () => {
    const d = disc({ name: 'Crank', diameter: 60, offsets: [10, 20] });
    expect([d.width, d.height]).toEqual([60, 60]);
    expect(d.holes.map((h) => [h.x, h.y])).toEqual([
      [30, 30],
      [40, 30],
      [50, 30]
    ]);
  });

  it('disc: refuses a crank hole that falls off the edge', () => {
    expect(() => disc({ name: 'Crank', diameter: 40, offsets: [19] })).toThrow(/falls off/);
  });

  it('gear: tooth count and size follow from the pitch', () => {
    const g = gear({ name: 'Gear', teeth: 16, pitch: 9 });
    const corners = g.outline.split(/[ML]/).filter(Boolean).length;
    expect(corners).toBe(16 * 4);
    const pitchRadius = (16 * 9) / (2 * Math.PI);
    expect(g.width).toBeCloseTo(2 * (pitchRadius + 9 / Math.PI), 1);
  });

  it('gear: meshing distance is the sum of pitch radii', () => {
    expect(gearCentreDistance(16, 32, 9)).toBeCloseTo(((16 + 32) * 9) / (2 * Math.PI), 2);
  });

  it('gear: refuses teeth too small for card', () => {
    expect(() => gear({ name: 'Tiny', teeth: 20, pitch: 4 })).toThrow(/tear/);
  });

  it('cam: height is base plus lift', () => {
    const c = cam({ name: 'Cam', base: 40, lift: 12 });
    expect([c.width, c.height]).toEqual([40, 52]);
  });

  it('shape: refuses holes outside the shape', () => {
    expect(() =>
      shape({
        name: 'Body',
        width: 50,
        height: 30,
        path: 'M0 0H50V30H0Z',
        holes: [{ x: 60, y: 10, d: 4 }]
      })
    ).toThrow(/outside/);
  });
});

describe('layout on A4', () => {
  it('keeps every part inside the margins and above the check square', () => {
    const parts = [
      disc({ name: 'Wheel', diameter: 70 }),
      disc({ name: 'Wheel', diameter: 70 }),
      strip({ name: 'Axle holder', length: 150, width: 20, holes: 2 }),
      gear({ name: 'Gear', teeth: 24 })
    ];
    for (const { part, x, y } of layout(parts)) {
      expect(x).toBeGreaterThanOrEqual(MARGIN);
      expect(x + part.width).toBeLessThanOrEqual(A4.width - MARGIN);
      expect(y + part.height).toBeLessThanOrEqual(A4.height - MARGIN - CHECK_SQUARE);
    }
  });

  it('refuses a part wider than the sheet', () => {
    expect(() => layout([strip({ name: 'Long', length: 250, width: 20 })])).toThrow(/wide/);
  });

  it('asks to split when parts do not fit one sheet', () => {
    const many = Array.from({ length: 12 }, () => disc({ name: 'Wheel', diameter: 80 }));
    expect(() => layout(many)).toThrow(/two sheets/);
  });
});

describe('rendered sheet', () => {
  const svg = renderSheet(
    { title: 'Test <sheet>', parts: [disc({ name: 'Wheel', diameter: 50 })] },
    labels
  );

  it('is true-scale A4 (1 unit = 1 mm)', () => {
    expect(svg).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"');
  });

  it('has a 50 mm check square and its instruction', () => {
    expect(svg).toMatch(/<rect x="\d+" y="\d+" width="50" height="50"/);
    expect(svg).toContain(labels.checkSquare);
  });

  it('escapes text', () => {
    expect(svg).toContain('Test &lt;sheet&gt;');
    expect(svg).not.toContain('<sheet>');
  });

  it('contains no scripts, styles or links (safe to serve and print)', () => {
    expect(svg).not.toMatch(/<script|<style|style=|href=|on[a-z]+=/i);
  });

  it('lists measurements for drawing by hand', () => {
    expect(measurements({ title: 'x', parts: [disc({ name: 'Wheel', diameter: 50 })] })).toEqual([
      'Wheel: circle 50 mm across, hole in the centre'
    ]);
  });
});

describe('text wrapping', () => {
  it('keeps every line within the width', () => {
    const lines = wrap(
      'Print at 100% (Actual size). This square must measure 50 mm; if not, change your print settings.',
      130,
      3.4
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length * 3.4 * 0.55).toBeLessThanOrEqual(130);
  });
});
