import { describe, expect, it } from 'vitest';
import {
  A4,
  cam,
  CHECK_SQUARE,
  disc,
  gear,
  gearCentreDistance,
  internalCentreDistance,
  inWords,
  layout,
  MARGIN,
  measurements,
  rack,
  rackPitchLine,
  ringGear,
  renderSheet,
  type Say,
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

  it('rack: teeth along the top at the gear pitch, pitch line one module below the tips', () => {
    const r = rack({ name: 'Rack', teeth: 16 });
    expect(r.width).toBe(144);
    expect(r.height).toBeCloseTo(2.25 * (9 / Math.PI) + 12, 1);
    expect(rackPitchLine()).toBeCloseTo(9 / Math.PI, 2);
    expect(r.outline.split('L').length).toBe(16 * 4 + 4);
    expect(() => rack({ name: 'Rack', teeth: 16, pitch: 6 })).toThrow(/8 mm pitch/);
  });

  it('ring gear: teeth inside a ring; a gear meshes inside at the difference of pitch radii', () => {
    const g = ringGear({ name: 'Ring', teeth: 36 });
    const pitchRadius = (36 * 9) / (2 * Math.PI);
    expect(g.width).toBeCloseTo(2 * (pitchRadius + 1.25 * (9 / Math.PI) + 8), 1);
    expect(g.outline.match(/M/g)).toHaveLength(2); // outer edge and the teeth
    expect(internalCentreDistance(36, 12)).toBeCloseTo((24 * 9) / (2 * Math.PI), 2);
    expect(() => ringGear({ name: 'Ring', teeth: 60 })).toThrow(/180 mm/);
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
  it('keeps every part inside the margins, clear of the check square and instruction', () => {
    const parts = [
      shape({ name: 'Body', width: 150, height: 100, path: 'M0 0H150V100H0Z' }),
      ...Array.from({ length: 4 }, () => disc({ name: 'Wheel', diameter: 55 }))
    ];
    const squareX = A4.width - MARGIN - CHECK_SQUARE;
    const squareY = A4.height - MARGIN - CHECK_SQUARE;
    for (const { part, x, y } of layout(parts)) {
      expect(x).toBeGreaterThanOrEqual(MARGIN);
      expect(x + part.width).toBeLessThanOrEqual(A4.width - MARGIN);
      expect(y + part.height).toBeLessThanOrEqual(A4.height - MARGIN - 14);
      const overlapsSquare = x + part.width > squareX && y + part.height > squareY;
      expect(overlapsSquare).toBe(false);
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

  it('lists measurements for drawing by hand, in the words given', () => {
    const say: Say = (f, name) =>
      f.kind === 'disc' ? `${name}: circle ${f.diameter} mm across` : `${name}: ${f.kind}`;
    const part = shape({
      name: 'Body',
      width: 40,
      height: 20,
      path: 'M0 0H40V20H0Z',
      measurements: ['hole near the front']
    });
    expect(
      measurements({ title: 'x', parts: [disc({ name: 'Wheel', diameter: 50 }), part] }, say)
    ).toEqual(['Wheel: circle 50 mm across', 'Body: shape', 'hole near the front']);
  });

  it('a sheet in other words keeps exactly the same shapes and sizes', () => {
    const sheet = {
      title: 'Cart',
      parts: [
        strip({ name: 'Axle', length: 80, width: 12, holes: 2 }),
        disc({ name: 'Wheel', diameter: 50 })
      ]
    };
    const zu = inWords(sheet, { title: 'Inqola', parts: [{ name: 'I-ekseli' }, undefined] });
    expect(zu.parts.map((p) => p.name)).toEqual(['I-ekseli', 'Wheel']);
    const shapes = (svg: string) =>
      svg.replace(/<text[^>]*>[^<]*<\/text>|<title>[^<]*<\/title>/g, '');
    expect(shapes(renderSheet(zu, labels))).toBe(shapes(renderSheet(sheet, labels)));
    expect(renderSheet(zu, labels)).toContain('Inqola');
    expect(inWords(sheet)).toBe(sheet);
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
