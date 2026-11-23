// Draws the robot world from above on a canvas (M4 spec FR-1, FR-6). Areas use patterns as well
// as colour (hatch, dots, checks), so they can be told apart without colour (spec §5).
import {
  bodyPoint,
  LINE_AHEAD_MM,
  LINE_SIDE_MM,
  RADIUS_MM,
  type Area,
  type Sim,
  WHISKER_AHEAD_MM,
  WHISKER_SIDE_MM
} from '../../../../packages/sim/src/index';

/** Colours pass contrast on the light floor (WCAG 2.2 AA, non-text 3:1). */
export const WORLD_COLOURS = {
  floor: '#fbfaf5',
  grid: '#d8d4c6',
  gridOverlay: '#767676',
  gridLabel: '#333333',
  dark: '#5a5a5a',
  tunnel: '#3d3550',
  zone: '#1f6f8b',
  line: '#111111',
  wall: '#7a4a1e',
  target: '#c0392b',
  robot: '#0b5394',
  trail: '#e67e22',
  pen: '#6a1b9a',
  sensorOn: '#2e7d32',
  sensorOff: '#9e9e9e'
};

const C = WORLD_COLOURS;

const patterns = new Map<string, CanvasPattern | string>();

function pattern(ctx: CanvasRenderingContext2D, kind: Area['pattern'], colour: string) {
  // Drawn inside the world's scale, so the tile is in millimetres: a 40 mm repeat.
  const size = 40;
  const key = `${kind}|${colour}|${size}`;
  const cached = patterns.get(key);
  if (cached) return cached;
  // A plain canvas, not OffscreenCanvas: older phone browsers lack it.
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const t = tile.getContext('2d');
  if (!t) return colour;
  t.strokeStyle = colour;
  t.fillStyle = colour;
  t.lineWidth = 4;
  if (kind === 'dots') {
    t.beginPath();
    t.arc(size / 2, size / 2, size / 6, 0, Math.PI * 2);
    t.fill();
  } else if (kind === 'checks') {
    t.globalAlpha = 0.55;
    t.fillRect(0, 0, size / 2, size / 2);
    t.fillRect(size / 2, size / 2, size / 2, size / 2);
  } else {
    t.beginPath();
    t.moveTo(0, size);
    t.lineTo(size, 0);
    t.stroke();
  }
  const made = ctx.createPattern(tile, 'repeat') ?? colour;
  patterns.set(key, made);
  return made;
}

export interface DrawOptions {
  /** Canvas pixels per millimetre. */
  scale: number;
  trail: { x: number; y: number }[] | null;
  /** The grid overlay with its labels (FR-12), or null. Courses always show their own grid lines. */
  grid: { cols: number; rows: number; cell: number } | null;
  /** Device pixels per CSS pixel, so labels stay readable on sharp screens. */
  dpr?: number;
}

export function drawWorld(ctx: CanvasRenderingContext2D, sim: Sim, opts: DrawOptions): void {
  const w = sim.world;
  const s = opts.scale;
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(s, s);
  ctx.fillStyle = C.floor;
  ctx.fillRect(0, 0, w.width, w.height);

  const grid = opts.grid ?? w.grid;
  if (grid) {
    ctx.strokeStyle = opts.grid ? C.gridOverlay : C.grid;
    ctx.lineWidth = (opts.grid ? 1.5 : 1) / s;
    for (let c = 0; c <= grid.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * grid.cell, 0);
      ctx.lineTo(c * grid.cell, w.height);
      ctx.stroke();
    }
    for (let r = 0; r <= grid.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * grid.cell);
      ctx.lineTo(w.width, r * grid.cell);
      ctx.stroke();
    }
  }

  for (const a of w.areas) {
    const colour = a.dark ? C.dark : a.light !== undefined && a.light < 100 ? C.tunnel : C.zone;
    ctx.fillStyle = pattern(ctx, a.pattern ?? (a.dark ? 'checks' : 'hatch'), colour);
    ctx.globalAlpha = a.light !== undefined && a.light < 100 ? 0.85 : 0.5;
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2 / s;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
  }

  ctx.strokeStyle = C.line;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const l of w.lines) {
    ctx.lineWidth = l.width;
    ctx.beginPath();
    l.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  for (const solid of w.solids) {
    ctx.fillStyle = solid.kind === 'wall' ? C.wall : C.target;
    ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
  }

  if (opts.trail && opts.trail.length > 1) {
    ctx.strokeStyle = C.trail;
    ctx.lineWidth = 3 / s;
    ctx.setLineDash([8 / s, 6 / s]);
    ctx.beginPath();
    opts.trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = C.pen;
  ctx.lineWidth = 4;
  for (const [x1, y1, x2, y2] of sim.strokes) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // The cart: body, a nose showing its heading, and its sensors (green when they see something).
  const p = sim.pose;
  const state = { x: p.x, y: p.y, heading: (p.heading * Math.PI) / 180 };
  ctx.fillStyle = C.robot;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS_MM, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const nose = bodyPoint(state, RADIUS_MM, 'left', 0);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(nose.x, nose.y);
  ctx.stroke();
  for (const side of ['left', 'right'] as const) {
    const wp = bodyPoint(state, WHISKER_AHEAD_MM, side, WHISKER_SIDE_MM);
    ctx.fillStyle = sim.whisker(side) ? C.sensorOn : C.sensorOff;
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 7, 0, Math.PI * 2);
    ctx.fill();
    const lp = bodyPoint(state, LINE_AHEAD_MM, side, LINE_SIDE_MM);
    ctx.fillStyle = sim.line(side) ? C.sensorOn : '#ffffff';
    ctx.fillRect(lp.x - 6, lp.y - 6, 12, 12);
  }
  if (opts.grid) drawGridLabels(ctx, opts.grid, s / (opts.dpr ?? 1));
  ctx.restore();
}

/** Column letters along the top and row numbers down the left, 12 CSS px high (`s`: CSS px per mm). */
function drawGridLabels(
  ctx: CanvasRenderingContext2D,
  grid: { cols: number; rows: number; cell: number },
  s: number
) {
  const size = 12 / s;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3 / s;
  ctx.strokeStyle = C.floor;
  ctx.fillStyle = C.gridLabel;
  const label = (text: string, x: number, y: number) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };
  for (let c = 0; c < grid.cols; c++) {
    label(String.fromCharCode(65 + c), c * grid.cell + 4 / s, 3 / s);
  }
  for (let r = 0; r < grid.rows; r++) label(String(r + 1), 3 / s, r * grid.cell + size + 6 / s);
}
