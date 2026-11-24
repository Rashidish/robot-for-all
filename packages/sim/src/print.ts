// Print course (M4 spec FR-19, §14.4): any world or course as A4 pages at 1:1 scale — a first
// page (print at 100 %, 100 mm calibration square, assembly map), floor tiles with tile numbers,
// alignment marks and grid labels, and a build sheet listing every cardboard piece. SVG only
// (the browser prints it), no PDF library, low ink: outlines and hatching, no solid fills.
// Pure functions, no DOM: the page code loads this only when a learner taps Print.
import { buildSheet, type BuildItem } from './build-sheet';
import { cellName, type World } from './world';

export const A4_W = 210;
export const A4_H = 297;
/** The part of the course on each tile page (mm), inside the printer's margins. */
export const TILE_W = 190;
export const TILE_H = 270;
const TILE_X = (A4_W - TILE_W) / 2;
const TILE_Y = 17;
export const CALIBRATION_MM = 100;

/** Words printed on the pages, from the translation file. */
export interface PrintLabels {
  title: string;
  printAt100: string;
  calibration: string;
  size: string;
  assembly: string;
  tile: string;
  tiles: string;
  buildSheet: string;
  pieces: Record<BuildItem['piece'], string>;
  edges: Record<'N' | 'E' | 'S' | 'W', string>;
  noPrinter: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
  );
const n = (v: number) => String(Math.round(v * 100) / 100);

function page(body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_W}mm" height="${A4_H}mm" ` +
    `viewBox="0 0 ${A4_W} ${A4_H}" font-family="sans-serif">${body}</svg>`
  );
}

function text(x: number, y: number, size: number, s: string, extra = ''): string {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}"${extra}>${esc(s)}</text>`;
}

/** The course itself in world millimetres (drawn into a tile, or scaled down for the map). */
function course(w: World, items: BuildItem[], hatchId: string, detail: boolean): string {
  const out: string[] = [];
  const g = w.grid ?? {
    cols: Math.ceil(w.width / 200),
    rows: Math.ceil(w.height / 200),
    cell: 200
  };
  out.push(
    `<rect x="0" y="0" width="${w.width}" height="${w.height}" fill="none" stroke="#000" stroke-width="1"/>`
  );
  for (let c = 1; c < g.cols; c++) {
    out.push(
      `<line x1="${c * g.cell}" y1="0" x2="${c * g.cell}" y2="${w.height}" stroke="#999" stroke-width="0.5" stroke-dasharray="4 4"/>`
    );
  }
  for (let r = 1; r < g.rows; r++) {
    out.push(
      `<line x1="0" y1="${r * g.cell}" x2="${w.width}" y2="${r * g.cell}" stroke="#999" stroke-width="0.5" stroke-dasharray="4 4"/>`
    );
  }
  if (detail) {
    for (let c = 0; c < g.cols; c++) {
      for (let r = 0; r < g.rows; r++) {
        out.push(text(c * g.cell + 6, r * g.cell + 14, 9, cellName(c, r), ' fill="#777"'));
      }
    }
  }
  for (const a of w.areas) {
    out.push(
      `<rect x="${n(a.x)}" y="${n(a.y)}" width="${n(a.w)}" height="${n(a.h)}" fill="url(#${hatchId})" stroke="#000" stroke-width="1"/>`
    );
  }
  // Tape lines: the outline of the tape band, so learners lay black insulation tape on it.
  for (const l of w.lines) {
    const d = l.points.map((p, i) => `${i ? 'L' : 'M'}${n(p.x)} ${n(p.y)}`).join('');
    out.push(
      `<path d="${d}" fill="none" stroke="#000" stroke-width="${l.width}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
    out.push(
      `<path d="${d}" fill="none" stroke="#fff" stroke-width="${l.width - 2}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  // Cardboard pieces: their place on the floor, numbered as on the build sheet.
  items.forEach((it, i) => {
    const r = it.rect;
    out.push(
      `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" fill="none" stroke="#000" stroke-width="1.5"/>`
    );
    if (detail) {
      // The number goes beside the piece, always inside the course so it is never cut off.
      const lx = Math.min(w.width - 16, Math.max(6, r.x + r.w / 2 + (r.w < r.h ? 8 : -4)));
      const ly = Math.min(w.height - 6, Math.max(18, r.y + r.h / 2 + (r.w < r.h ? 4 : 16)));
      out.push(text(lx, ly, 12, String(i + 1), ' font-weight="700"'));
    }
  });
  const s = w.start;
  const h = (s.heading * Math.PI) / 180;
  const tip = { x: s.x + Math.cos(h) * 70, y: s.y + Math.sin(h) * 70 };
  out.push(
    `<circle cx="${n(s.x)}" cy="${n(s.y)}" r="60" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="6 4"/>`
  );
  out.push(
    `<line x1="${n(s.x)}" y1="${n(s.y)}" x2="${n(tip.x)}" y2="${n(tip.y)}" stroke="#000" stroke-width="2"/>`
  );
  return out.join('');
}

function hatch(id: string, scale: number): string {
  const sz = 8 * scale;
  return (
    `<defs><pattern id="${id}" width="${n(sz)}" height="${n(sz)}" patternUnits="userSpaceOnUse">` +
    `<path d="M0 ${n(sz)}L${n(sz)} 0" stroke="#000" stroke-width="${n(0.4 * scale)}"/></pattern></defs>`
  );
}

/** Every page for printing this course, in order: first page, tiles, build sheet. */
export function coursePages(w: World, labels: PrintLabels): string[] {
  const items = buildSheet(w);
  const cols = Math.ceil(w.width / TILE_W);
  const rows = Math.ceil(w.height / TILE_H);
  const pages: string[] = [];

  // First page: print at 100 %, calibration square, assembly map.
  const mapScale = Math.min(170 / w.width, 120 / w.height);
  const map: string[] = [course(w, items, 'h0', false)];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * TILE_W;
      const y = r * TILE_H;
      map.push(
        `<rect x="${x}" y="${y}" width="${Math.min(TILE_W, w.width - x)}" height="${Math.min(TILE_H, w.height - y)}" fill="none" stroke="#000" stroke-width="${n(1 / mapScale)}"/>`
      );
      map.push(
        text(
          x + 8 / mapScale,
          y + 16 / mapScale,
          12 / mapScale,
          String(r * cols + c + 1),
          ' font-weight="700"'
        )
      );
    }
  }
  pages.push(
    page(
      hatch('h0', 1 / mapScale) +
        text(15, 20, 8, labels.title, ' font-weight="700"') +
        text(15, 30, 5, labels.printAt100, ' font-weight="700"') +
        text(
          15,
          38,
          4,
          `${labels.size}: ${w.width} × ${w.height} mm · ${cols * rows} ${labels.tiles}`
        ) +
        text(15, 46, 4, labels.noPrinter) +
        `<rect x="15" y="55" width="${CALIBRATION_MM}" height="${CALIBRATION_MM}" fill="none" stroke="#000" stroke-width="0.5"/>` +
        text(20, 63, 4, labels.calibration) +
        text(15, 168, 5, labels.assembly, ' font-weight="700"') +
        `<g transform="translate(20 ${172}) scale(${n(mapScale)})">${map.join('')}</g>`
    )
  );

  // Floor tiles at 1:1, each with its number, neighbours' alignment marks and a start note.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const num = r * cols + c + 1;
      const x0 = c * TILE_W;
      const y0 = r * TILE_H;
      const tw = Math.min(TILE_W, w.width - x0);
      const th = Math.min(TILE_H, w.height - y0);
      const clip = `t${num}`;
      const marks: string[] = [];
      for (const [mx, my] of [
        [0, 0],
        [tw, 0],
        [0, th],
        [tw, th]
      ] as const) {
        const ax = TILE_X + mx;
        const ay = TILE_Y + my;
        marks.push(
          `<path d="M${n(ax - 6)} ${n(ay)}H${n(ax + 6)}M${n(ax)} ${n(ay - 6)}V${n(ay + 6)}" stroke="#000" stroke-width="0.3"/>`
        );
      }
      pages.push(
        page(
          hatch(`h${num}`, 1) +
            `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${tw}" height="${th}"/></clipPath></defs>` +
            text(TILE_X, 10, 6, `${labels.tile} ${num} · ${labels.title}`, ' font-weight="700"') +
            text(TILE_X, 15, 3.5, `${labels.size}: ${tw} × ${th} mm`) +
            `<g transform="translate(${TILE_X} ${TILE_Y})" clip-path="url(#${clip})"><g transform="translate(${-x0} ${-y0})">${course(w, items, `h${num}`, true)}</g></g>` +
            `<rect x="${TILE_X}" y="${TILE_Y}" width="${tw}" height="${th}" fill="none" stroke="#000" stroke-width="0.3" stroke-dasharray="2 2"/>` +
            marks.join('') +
            text(TILE_X, A4_H - 4, 3, labels.printAt100)
        )
      );
    }
  }

  // Build sheet: every cardboard piece and where it goes (positions, not materials).
  if (items.length > 0) {
    const perPage = 40;
    for (let p = 0; p * perPage < items.length; p++) {
      const lines = items.slice(p * perPage, (p + 1) * perPage).map((it, i) => {
        const k = p * perPage + i + 1;
        const where = `${it.cell}${it.edge ? `, ${labels.edges[it.edge]}` : ''}`;
        return text(
          15,
          40 + i * 6,
          4,
          `${k}. ${labels.pieces[it.piece]}${it.lengthMm ? ` ${it.lengthMm} mm` : ''} — ${where}`
        );
      });
      pages.push(
        page(
          text(15, 20, 8, labels.buildSheet, ' font-weight="700"') +
            text(15, 30, 4, `${labels.title} · ${items.length}`) +
            lines.join('')
        )
      );
    }
  }
  return pages;
}
