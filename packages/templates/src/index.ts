// Cardboard template generator (M2 spec FR-5, FR-6, FR-8).
// Pure functions that draw parts in millimetres and lay them out on a true-scale A4 sheet.
// Runs only at build time: learners download the finished SVG, never this code.

export const A4 = { width: 210, height: 297 } as const;
export const MARGIN = 10;
export const CHECK_SQUARE = 50;
/** Space between parts; part names are printed in it, above each part. */
const GAP = 9;
const TITLE_SPACE = 20;
const FOOTER_SPACE = CHECK_SQUARE + 14;
/** Room kept at the bottom-left for the two-line print instruction. */
const INSTRUCTION_SPACE = 14;

export interface Hole {
  x: number;
  y: number;
  /** Diameter in mm. */
  d: number;
}

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * A measurement of a part, as numbers. The words come from the translation file (`Say`), so a
 * part can be drawn by hand from its measurements in any language (translate-templates spec §2.2).
 * Numbers are already rounded and formatted as text ("12.5").
 */
export type Fact =
  | { kind: 'strip'; length: string; width: string }
  | { kind: 'strip_holes'; count: number; inset: string; spacing: string }
  | { kind: 'strip_middle_hole' }
  | { kind: 'disc'; diameter: string }
  | { kind: 'disc_holes'; offsets: string }
  | { kind: 'gear'; teeth: number; tips: string }
  | { kind: 'gear_spacing'; radius: string }
  | { kind: 'cam'; base: string; height: string }
  | { kind: 'shape'; width: string; height: string };

/** Turns a fact about the part called `name` into a sentence in the page's language. */
export type Say = (fact: Fact, name: string) => string;

/** A part to cut out, drawn with its top-left corner at (0, 0). Sizes in mm. */
export interface Part {
  name: string;
  width: number;
  height: number;
  /** SVG path data for the cut line. */
  outline: string;
  holes: Hole[];
  folds: Line[];
  /** Measurements so a part can be drawn by hand with a ruler; turned into words by `Say`. */
  facts: Fact[];
  /** Extra notes written for this part (e.g. where its holes go), in English; translated in the lesson translation. */
  notes: string[];
}

/** Words printed on the sheet; supplied from the translation file. */
export interface SheetLabels {
  checkSquare: string;
  key: string;
}

/**
 * A sheet's own words in another language (from the lesson translation): its title, and each
 * part's name and notes in the same order as the sheet. Missing ones stay as written.
 */
export interface SheetWords {
  title?: string | undefined;
  parts?: ({ name?: string | undefined; notes?: string[] | undefined } | undefined)[] | undefined;
}

export interface SheetDefinition {
  title: string;
  parts: Part[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => String(r2(n));

function circlePath(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`;
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** A flat strip (lever arm, linkage bar) with evenly spaced holes along its centre line. */
export function strip(opts: {
  name: string;
  length: number;
  width: number;
  holes?: number;
  holeDiameter?: number;
}): Part {
  const { name, length, width, holes = 0, holeDiameter = 4 } = opts;
  check(length >= 20 && width >= 8, `${name}: strips must be at least 20 × 8 mm`);
  check(holeDiameter < width - 3, `${name}: holes must be narrower than the strip`);
  const r = Math.min(4, width / 2);
  const outline =
    `M${fmt(r)} 0H${fmt(length - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(length)} ${fmt(r)}` +
    `V${fmt(width - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(length - r)} ${fmt(width)}` +
    `H${fmt(r)}A${fmt(r)} ${fmt(r)} 0 0 1 0 ${fmt(width - r)}V${fmt(r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} 0Z`;
  const inset = Math.max(width / 2, holeDiameter);
  const spacing = holes > 1 ? (length - 2 * inset) / (holes - 1) : 0;
  const list: Hole[] = Array.from({ length: holes }, (_, i) => ({
    x: r2(holes === 1 ? length / 2 : inset + i * spacing),
    y: r2(width / 2),
    d: holeDiameter
  }));
  const facts: Fact[] = [{ kind: 'strip', length: fmt(length), width: fmt(width) }];
  if (holes > 1) {
    facts.push({ kind: 'strip_holes', count: holes, inset: fmt(inset), spacing: fmt(spacing) });
  } else if (holes === 1) {
    facts.push({ kind: 'strip_middle_hole' });
  }
  return { name, width: length, height: width, outline, holes: list, folds: [], facts, notes: [] };
}

/** A round disc (wheel or crank disc) with a centre axle hole and optional off-centre holes. */
export function disc(opts: {
  name: string;
  diameter: number;
  axleHole?: number;
  /** Distances from the centre for crank pin holes, in mm. */
  offsets?: number[];
  pinHole?: number;
}): Part {
  const { name, diameter, axleHole = 4, offsets = [], pinHole = 4 } = opts;
  const r = diameter / 2;
  check(diameter >= 20 && diameter <= 180, `${name}: discs must be 20–180 mm across`);
  for (const o of offsets) {
    check(o + pinHole / 2 < r - 2, `${name}: a ${o} mm offset hole falls off the disc`);
  }
  const holes: Hole[] = [
    { x: r, y: r, d: axleHole },
    ...offsets.map((o) => ({ x: r2(r + o), y: r, d: pinHole }))
  ];
  const facts: Fact[] = [{ kind: 'disc', diameter: fmt(diameter) }];
  if (offsets.length) facts.push({ kind: 'disc_holes', offsets: offsets.map(fmt).join(', ') });
  return {
    name,
    width: diameter,
    height: diameter,
    outline: circlePath(r, r, r),
    holes,
    folds: [],
    facts,
    notes: []
  };
}

/**
 * A simple gear with straight-sided teeth that cut cleanly from card.
 * pitch = distance from one tooth to the next around the gear (mm). Gears that mesh share a pitch.
 */
export function gear(opts: {
  name: string;
  teeth: number;
  pitch?: number;
  axleHole?: number;
}): Part {
  const { name, teeth, pitch = 9, axleHole = 4 } = opts;
  check(Number.isInteger(teeth) && teeth >= 8 && teeth <= 60, `${name}: use 8–60 teeth`);
  check(pitch >= 8, `${name}: card teeth smaller than 8 mm pitch tear easily`);
  const pitchRadius = (teeth * pitch) / (2 * Math.PI);
  const module = pitch / Math.PI;
  const tip = pitchRadius + module;
  const root = pitchRadius - 1.25 * module;
  const step = (2 * Math.PI) / teeth;
  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const corners: [number, number][] = [
      [root, a - step * 0.28],
      [tip, a - step * 0.16],
      [tip, a + step * 0.16],
      [root, a + step * 0.28]
    ];
    for (const [radius, angle] of corners) {
      points.push(`${fmt(tip + radius * Math.cos(angle))} ${fmt(tip + radius * Math.sin(angle))}`);
    }
  }
  const outline = `M${points.join('L')}Z`;
  return {
    name,
    width: r2(2 * tip),
    height: r2(2 * tip),
    outline,
    holes: [{ x: r2(tip), y: r2(tip), d: axleHole }],
    folds: [],
    facts: [
      { kind: 'gear', teeth, tips: fmt(2 * tip) },
      { kind: 'gear_spacing', radius: fmt(pitchRadius) }
    ],
    notes: []
  };
}

/** The distance between axles for two gears of the same pitch to mesh. */
export function gearCentreDistance(teethA: number, teethB: number, pitch = 9): number {
  return r2(((teethA + teethB) * pitch) / (2 * Math.PI));
}

/** An egg-shaped cam: turning it lifts a follower by `lift` mm once per turn. */
export function cam(opts: { name: string; base: number; lift: number; axleHole?: number }): Part {
  const { name, base, lift, axleHole = 4 } = opts;
  check(
    base >= 20 && lift > 0 && lift <= base,
    `${name}: lift must be between 0 and the base size`
  );
  const r = base / 2;
  const height = base + lift;
  const outline =
    `M0 ${fmt(r + lift)}A${fmt(r)} ${fmt(r)} 0 0 0 ${fmt(base)} ${fmt(r + lift)}` +
    `C${fmt(base)} ${fmt(r * 0.6)} ${fmt(r + r * 0.35)} 0 ${fmt(r)} 0` +
    `C${fmt(r - r * 0.35)} 0 0 ${fmt(r * 0.6)} 0 ${fmt(r + lift)}Z`;
  return {
    name,
    width: base,
    height,
    outline,
    holes: [{ x: r, y: r2(r + lift), d: axleHole }],
    folds: [],
    facts: [{ kind: 'cam', base: fmt(base), height: fmt(height) }],
    notes: []
  };
}

/** A shape drawn as SVG path data (animal bodies, heads), with optional holes and fold lines. */
export function shape(opts: {
  name: string;
  width: number;
  height: number;
  path: string;
  holes?: Hole[];
  folds?: Line[];
  /** Notes for drawing it by hand (e.g. where the holes go); translated in the lesson translation. */
  measurements?: string[];
}): Part {
  const { name, width, height, path, holes = [], folds = [], measurements = [] } = opts;
  check(width > 0 && height > 0, `${name}: give the shape a size`);
  for (const h of holes) {
    check(
      h.x > 0 && h.x < width && h.y > 0 && h.y < height,
      `${name}: a hole is outside the shape`
    );
  }
  return {
    name,
    width,
    height,
    outline: path,
    holes,
    folds,
    facts: [{ kind: 'shape', width: fmt(width), height: fmt(height) }],
    notes: measurements
  };
}

export interface Placed {
  part: Part;
  x: number;
  y: number;
}

/** Left edge of the 50 mm check square (bottom-right corner of the sheet). */
const squareLeft = A4.width - MARGIN - CHECK_SQUARE;

/**
 * Shelf-packs parts onto one A4 sheet, leaving room for the title, the check square and the
 * print instruction. Parts fully to the left of the square may use the space beside it.
 */
export function layout(parts: Part[]): Placed[] {
  const left = MARGIN;
  const right = A4.width - MARGIN;
  const top = MARGIN + TITLE_SPACE;
  const bottomFor = (x: number, width: number) =>
    x + width <= squareLeft - GAP
      ? A4.height - MARGIN - INSTRUCTION_SPACE
      : A4.height - MARGIN - FOOTER_SPACE;
  const placed: Placed[] = [];
  let x = left;
  let y = top;
  let rowHeight = 0;
  const sorted = [...parts].sort((a, b) => b.height - a.height);
  for (const part of sorted) {
    check(
      part.width <= right - left,
      `${part.name} is ${fmt(part.width)} mm wide; the sheet fits ${right - left} mm`
    );
    if (x + part.width > right) {
      x = left;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    check(
      y + part.height <= bottomFor(x, part.width),
      `Too many parts for one A4 sheet: split them into two sheets`
    );
    placed.push({ part, x, y });
    x += part.width + GAP;
    rowHeight = Math.max(rowHeight, part.height);
  }
  return placed;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Splits text into lines that fit `width` mm at `fontSize` (approximate, for sans-serif). */
export function wrap(text: string, width: number, fontSize: number): string[] {
  const maxChars = Math.max(10, Math.floor(width / (fontSize * 0.55)));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The sheet with a language's own words in place of the English ones (same shapes and sizes). */
export function inWords(sheet: SheetDefinition, words?: SheetWords): SheetDefinition {
  if (!words) return sheet;
  return {
    title: words.title ?? sheet.title,
    parts: sheet.parts.map((p, i) => {
      const w = words.parts?.[i];
      return { ...p, name: w?.name ?? p.name, notes: w?.notes ?? p.notes };
    })
  };
}

/** Renders a sheet as a true-scale A4 SVG (1 unit = 1 mm). */
export function renderSheet(sheet: SheetDefinition, labels: SheetLabels): string {
  const placed = layout(sheet.parts);
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${A4.width}mm" height="${A4.height}mm" viewBox="0 0 ${A4.width} ${A4.height}" font-family="system-ui, sans-serif">`,
    `<title>${esc(sheet.title)}</title>`,
    `<rect width="${A4.width}" height="${A4.height}" fill="#fff"/>`,
    `<text x="${MARGIN}" y="${MARGIN + 7}" font-size="6" font-weight="700" fill="#000">${esc(sheet.title)}</text>`,
    `<text x="${MARGIN}" y="${MARGIN + 12.5}" font-size="3.2" fill="#333">${esc(labels.key)}</text>`
  );
  for (const { part, x, y } of placed) {
    out.push(`<g transform="translate(${fmt(x)} ${fmt(y)})">`);
    out.push(`<path d="${part.outline}" fill="none" stroke="#000" stroke-width="0.5"/>`);
    for (const f of part.folds) {
      out.push(
        `<line x1="${fmt(f.x1)}" y1="${fmt(f.y1)}" x2="${fmt(f.x2)}" y2="${fmt(f.y2)}" stroke="#000" stroke-width="0.4" stroke-dasharray="3 2"/>`
      );
    }
    for (const h of part.holes) {
      const r = h.d / 2;
      out.push(
        `<circle cx="${fmt(h.x)}" cy="${fmt(h.y)}" r="${fmt(r)}" fill="none" stroke="#000" stroke-width="0.35"/>`,
        `<path d="M${fmt(h.x - r)} ${fmt(h.y)}h${fmt(h.d)}M${fmt(h.x)} ${fmt(h.y - r)}v${fmt(h.d)}" stroke="#000" stroke-width="0.25"/>`
      );
    }
    // The name sits just above the part, so it never crosses a cut line or a hole.
    out.push(`<text x="0" y="-1.8" font-size="3.2" fill="#555">${esc(part.name)}</text>`);
    out.push('</g>');
  }
  const sx = squareLeft;
  const sy = A4.height - MARGIN - CHECK_SQUARE;
  out.push(
    `<rect x="${sx}" y="${sy}" width="${CHECK_SQUARE}" height="${CHECK_SQUARE}" fill="none" stroke="#000" stroke-width="0.5"/>`,
    `<text x="${sx + CHECK_SQUARE / 2}" y="${sy + CHECK_SQUARE / 2 + 2}" font-size="5" font-weight="700" text-anchor="middle">50 mm</text>`,
    ...wrap(labels.checkSquare, sx - MARGIN - 6, 3.4).map(
      (line, i, all) =>
        `<text x="${MARGIN}" y="${fmt(A4.height - MARGIN - 2 - (all.length - 1 - i) * 4.6)}" font-size="3.4" fill="#000">${esc(line)}</text>`
    ),
    '</svg>'
  );
  return out.join('\n');
}

/** All measurements on a sheet, in words, for drawing parts by hand without a printer. */
export function measurements(sheet: SheetDefinition, say: Say): string[] {
  return sheet.parts.flatMap((p) => [...p.facts.map((f) => say(f, p.name)), ...p.notes]);
}

/** Helper for template files: keeps them typed. */
export function defineSheet(sheet: SheetDefinition): SheetDefinition {
  return sheet;
}
