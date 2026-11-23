// World and course format (FR-4, FR-16): checked data, with the path to each problem.
// A world is JSON in content/worlds/<id>.json. A course is a world with a cell grid, cardboard
// pieces on the grid, missions and scoring (spec §14.4). A random maze course (FR-18) is
// expanded here from its maze number. All lengths are millimetres; headings are degrees,
// clockwise from east (screen coordinates, y down).
import { generateMaze, isOpenEast, isOpenSouth, MAZE_MAX, MAZE_MIN, mazeNeighbours } from './maze';
import { canonicalJson, hashText, type Point, type Rect } from './util';

export const CELL_MM = 200;
export const LINE_WIDTH_MM = 19; // insulation tape
export const WALL_THICKNESS_MM = 10;
export const TARGET_LENGTH_MM = 120;
export const TUNNEL_LIGHT = 20;
export const DEFAULT_LIGHT = 200;
export const FORMAT_VERSION = 1;

export type Pattern = 'hatch' | 'dots' | 'checks';
export type BumpMode = 'shake' | 'whiskers';
export type Edge = 'N' | 'E' | 'S' | 'W';

export interface Area extends Rect {
  id?: string;
  /** Light level (0–255) the micro:bit sees here, e.g. under a tunnel roof. */
  light?: number;
  /** Dark floor: line sensors see it as a line. */
  dark?: boolean;
  pattern?: Pattern;
}

export interface Line {
  points: Point[];
  width: number;
}

export interface Solid extends Rect {
  kind: 'wall' | 'target';
  id?: string;
}

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface Goal {
  /** Areas to pass through, in order, before the goal counts. */
  visit: string[];
  reach?: string;
  stopInside?: string;
}

export type Mission = { id: string; points: number } & (
  | { type: 'reachZone'; zone: string }
  | { type: 'stopInZone'; zone: string }
  | { type: 'checkpoints'; zones: string[] }
  | { type: 'touchTarget'; target: string }
  | { type: 'passTunnel'; tunnel: string }
  | { type: 'returnHome'; zone: string }
);

export interface Scoring {
  /** Most bonus points, for finishing at once; falls to 0 at the time limit. */
  timeBonus: number;
  /** Points per wall touch (0 or less). */
  wallTouch: number;
}

export interface Grid {
  cols: number;
  rows: number;
  cell: number;
}

/** A standard cardboard piece on the grid, as the build sheet lists it. */
export interface Piece {
  piece: 'wall' | 'target' | 'tunnel';
  cell: string;
  edge?: Edge;
  length?: 1 | 2;
  id?: string;
  dir?: 'ew' | 'ns';
}

export interface World {
  id: string;
  version: number;
  /** i18n key of the challenge text, or null for free driving. */
  challenge: string | null;
  width: number;
  height: number;
  light: number;
  grid: Grid | null;
  areas: Area[];
  lines: Line[];
  solids: Solid[];
  pieces: Piece[];
  start: Pose;
  bump: BumpMode;
  goal: Goal | null;
  timeLimitMs: number | null;
  noBumps: boolean;
  missions: Mission[];
  scoring: Scoring | null;
  maze: { kind: 'walls' | 'lines'; size: number; seed: number } | null;
}

export interface Problem {
  path: string;
  message: string;
}

export class WorldError extends Error {
  readonly problems: Problem[];
  constructor(problems: Problem[]) {
    super(`Invalid world:\n${problems.map((p) => `  ${p.path}: ${p.message}`).join('\n')}`);
    this.problems = problems;
  }
}

export interface BuildOptions {
  /** Maze number for a random maze course (FR-18). */
  seed?: number;
  /** Maze size (3–6) for a random maze course. */
  mazeSize?: number;
}

/** Check a world without building it. An empty list means it is valid. */
export function checkWorld(spec: unknown, opts: BuildOptions = {}): Problem[] {
  return parse(spec, opts).problems;
}

/** Check and build a world; throws WorldError listing every problem. */
export function buildWorld(spec: unknown, opts: BuildOptions = {}): World {
  const { world, problems } = parse(spec, opts);
  if (problems.length > 0 || !world) throw new WorldError(problems);
  return world;
}

/** A short fingerprint of exactly this world (after a maze is expanded). */
export function worldHash(world: World): string {
  return hashText(canonicalJson(world));
}

/** "C4" → column 2, row 3 (zero-based). Columns are letters from the left, rows numbers from the top. */
export function parseCell(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z])([1-9][0-9]?)$/.exec(ref);
  if (!m) return null;
  return { col: (m[1] ?? 'A').charCodeAt(0) - 65, row: Number(m[2]) - 1 };
}

export function cellName(col: number, row: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

/** The grid square under a point, e.g. "C4", or null when off the grid. */
export function cellAt(world: World, p: Point): string | null {
  const g = world.grid;
  if (!g) return null;
  const col = Math.floor(p.x / g.cell);
  const row = Math.floor(p.y / g.cell);
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return null;
  return cellName(col, row);
}

// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;

class Checker {
  problems: Problem[] = [];
  err(path: string, message: string): void {
    this.problems.push({ path, message });
  }
  obj(v: unknown, path: string): Obj | null {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      this.err(path, 'must be an object');
      return null;
    }
    return v as Obj;
  }
  arr(v: unknown, path: string): unknown[] {
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      this.err(path, 'must be a list');
      return [];
    }
    return v;
  }
  num(v: unknown, path: string, min: number, max: number, int = false): number | null {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.err(path, 'must be a number');
      return null;
    }
    if (v < min || v > max) {
      this.err(path, `must be between ${min} and ${max}`);
      return null;
    }
    if (int && !Number.isInteger(v)) {
      this.err(path, 'must be a whole number');
      return null;
    }
    return v;
  }
  str(v: unknown, path: string, re?: RegExp, hint?: string): string | null {
    if (typeof v !== 'string' || v === '') {
      this.err(path, 'must be text');
      return null;
    }
    if (re && !re.test(v)) {
      this.err(path, hint ?? `must match ${re}`);
      return null;
    }
    return v;
  }
  oneOf<T extends string>(v: unknown, path: string, options: readonly T[]): T | null {
    if (typeof v !== 'string' || !options.includes(v as T)) {
      this.err(path, `must be one of ${options.join(', ')}`);
      return null;
    }
    return v as T;
  }
  known(o: Obj, path: string, keys: readonly string[]): void {
    for (const k of Object.keys(o))
      if (!keys.includes(k)) this.err(`${path}.${k}`, 'is not a known field');
  }
}

const ID_RE = /^[a-z]+(-[a-z]+)*$/;
const ID_HINT = 'must be lowercase words joined by hyphens, no digits (e.g. dark-tunnel)';
const KEY_RE = /^[a-z]+(_[a-z]+)+$/;
const PATTERNS = ['hatch', 'dots', 'checks'] as const;
const EDGES = ['N', 'E', 'S', 'W'] as const;
const MISSION_TYPES = [
  'reachZone',
  'stopInZone',
  'checkpoints',
  'touchTarget',
  'passTunnel',
  'returnHome'
] as const;
const WORLD_KEYS = [
  'id',
  'version',
  'challenge',
  'size',
  'grid',
  'light',
  'areas',
  'lines',
  'walls',
  'pieces',
  'start',
  'bump',
  'goal',
  'timeLimitMs',
  'noBumps',
  'missions',
  'scoring',
  'maze'
] as const;

function parse(spec: unknown, opts: BuildOptions): { world: World | null; problems: Problem[] } {
  const c = new Checker();
  const o = c.obj(spec, '$');
  if (!o) return { world: null, problems: c.problems };
  c.known(o, '$', WORLD_KEYS);

  const id = c.str(o.id, '$.id', ID_RE, ID_HINT) ?? '';
  const version = c.num(o.version, '$.version', 1, 1e6, true) ?? 1;
  let challenge: string | null = null;
  if (o.challenge !== null) {
    challenge = c.str(
      o.challenge,
      '$.challenge',
      KEY_RE,
      'must be an i18n key such as world_dark_tunnel_challenge'
    );
  }
  const light =
    o.light === undefined
      ? DEFAULT_LIGHT
      : (c.num(o.light, '$.light', 0, 255, true) ?? DEFAULT_LIGHT);
  const bump: BumpMode =
    o.bump === undefined ? 'shake' : (c.oneOf(o.bump, '$.bump', ['shake', 'whiskers']) ?? 'shake');

  // Maze (random course) — decides the grid.
  let maze: World['maze'] = null;
  if (o.maze !== undefined) {
    const m = c.obj(o.maze, '$.maze');
    if (m) {
      c.known(m, '$.maze', ['kind', 'size', 'seed']);
      const kind = c.oneOf(m.kind, '$.maze.kind', ['walls', 'lines']) ?? 'walls';
      const size =
        opts.mazeSize ??
        (m.size === undefined ? 4 : (c.num(m.size, '$.maze.size', MAZE_MIN, MAZE_MAX, true) ?? 4));
      const seed =
        opts.seed ??
        (m.seed === undefined ? 1 : (c.num(m.seed, '$.maze.seed', 0, 2 ** 31, true) ?? 1));
      if (size < MAZE_MIN || size > MAZE_MAX || !Number.isInteger(size)) {
        c.err('mazeSize', `must be a whole number between ${MAZE_MIN} and ${MAZE_MAX}`);
      } else if (!Number.isInteger(seed) || seed < 0) {
        c.err('seed', 'must be a whole number, 0 or more');
      } else maze = { kind, size, seed };
    }
  }

  // Grid and size.
  let grid: Grid | null = null;
  if (maze) {
    if (o.grid !== undefined) c.err('$.grid', 'is set by the maze size; leave it out');
    grid = { cols: maze.size, rows: maze.size, cell: CELL_MM };
  } else if (o.grid !== undefined) {
    const g = c.obj(o.grid, '$.grid');
    if (g) {
      c.known(g, '$.grid', ['cols', 'rows']);
      const cols = c.num(g.cols, '$.grid.cols', 1, 26, true);
      const rows = c.num(g.rows, '$.grid.rows', 1, 50, true);
      if (cols && rows) grid = { cols, rows, cell: CELL_MM };
    }
  }
  let width = 0;
  let height = 0;
  if (grid) {
    if (o.size !== undefined) c.err('$.size', 'is set by the grid; leave it out');
    width = grid.cols * grid.cell;
    height = grid.rows * grid.cell;
  } else if (o.maze === undefined) {
    const s = c.obj(o.size, '$.size');
    if (s) {
      c.known(s, '$.size', ['w', 'h']);
      width = c.num(s.w, '$.size.w', 400, 20000) ?? 0;
      height = c.num(s.h, '$.size.h', 400, 20000) ?? 0;
    }
  }

  const cellRect = (ref: unknown, path: string): Rect | null => {
    if (!grid) {
      c.err(path, 'needs a grid');
      return null;
    }
    const s = c.str(ref, path);
    if (s === null) return null;
    const cell = parseCell(s);
    if (!cell || cell.col >= grid.cols || cell.row >= grid.rows) {
      c.err(path, `must be a square on the grid, A1 to ${cellName(grid.cols - 1, grid.rows - 1)}`);
      return null;
    }
    return { x: cell.col * grid.cell, y: cell.row * grid.cell, w: grid.cell, h: grid.cell };
  };
  const pointIn = (x: number, y: number, path: string): boolean => {
    if (width === 0 || height === 0) return true; // the size is already reported
    if (x < 0 || y < 0 || x > width || y > height) {
      c.err(path, 'is outside the world');
      return false;
    }
    return true;
  };
  const rectIn = (r: Obj, path: string): Rect | null => {
    const x = c.num(r.x, `${path}.x`, 0, 20000);
    const y = c.num(r.y, `${path}.y`, 0, 20000);
    const w = c.num(r.w, `${path}.w`, 1, 20000);
    const h = c.num(r.h, `${path}.h`, 1, 20000);
    if (x === null || y === null || w === null || h === null) return null;
    if (width > 0 && height > 0 && (x + w > width || y + h > height)) {
      c.err(path, 'goes outside the world');
      return null;
    }
    return { x, y, w, h };
  };

  const ids = new Set<string>();
  const claimId = (v: unknown, path: string): string | null => {
    const s = c.str(v, path, ID_RE, ID_HINT);
    if (s === null) return null;
    if (ids.has(s)) {
      c.err(path, `"${s}" is used twice`);
      return null;
    }
    ids.add(s);
    return s;
  };

  // Areas (zones, dark patches, tunnels).
  const areas: Area[] = [];
  c.arr(o.areas, '$.areas').forEach((v, i) => {
    const path = `$.areas[${i}]`;
    const a = c.obj(v, path);
    if (!a) return;
    c.known(a, path, ['id', 'x', 'y', 'w', 'h', 'cell', 'span', 'light', 'dark', 'pattern']);
    let rect: Rect | null;
    if (a.cell !== undefined) {
      rect = cellRect(a.cell, `${path}.cell`);
      if (rect && a.span !== undefined) {
        const span = c.arr(a.span, `${path}.span`);
        const sc = c.num(span[0], `${path}.span[0]`, 1, 26, true);
        const sr = c.num(span[1], `${path}.span[1]`, 1, 50, true);
        if (sc && sr) rect = { ...rect, w: sc * CELL_MM, h: sr * CELL_MM };
        if (rect.x + rect.w > width || rect.y + rect.h > height)
          c.err(`${path}.span`, 'goes outside the grid');
      }
    } else rect = rectIn(a, path);
    if (!rect) return;
    const area: Area = { ...rect };
    if (a.id !== undefined) {
      const aid = claimId(a.id, `${path}.id`);
      if (aid) area.id = aid;
    }
    if (a.light !== undefined) {
      const l = c.num(a.light, `${path}.light`, 0, 255, true);
      if (l !== null) area.light = l;
    }
    if (a.dark !== undefined) {
      if (typeof a.dark !== 'boolean') c.err(`${path}.dark`, 'must be true or false');
      else if (a.dark) area.dark = true;
    }
    if (a.pattern !== undefined) {
      const p = c.oneOf(a.pattern, `${path}.pattern`, PATTERNS);
      if (p) area.pattern = p;
    }
    areas.push(area);
  });

  // Lines (tape).
  const lines: Line[] = [];
  c.arr(o.lines, '$.lines').forEach((v, i) => {
    const path = `$.lines[${i}]`;
    const l = c.obj(v, path);
    if (!l) return;
    c.known(l, path, ['points', 'cells', 'width']);
    const lineWidth =
      l.width === undefined
        ? LINE_WIDTH_MM
        : (c.num(l.width, `${path}.width`, 5, 60) ?? LINE_WIDTH_MM);
    const points: Point[] = [];
    if (l.cells !== undefined) {
      c.arr(l.cells, `${path}.cells`).forEach((ref, j) => {
        const r = cellRect(ref, `${path}.cells[${j}]`);
        if (r) points.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      });
    } else {
      c.arr(l.points, `${path}.points`).forEach((p, j) => {
        const pp = c.arr(p, `${path}.points[${j}]`);
        const x = c.num(pp[0], `${path}.points[${j}][0]`, 0, 20000);
        const y = c.num(pp[1], `${path}.points[${j}][1]`, 0, 20000);
        if (x !== null && y !== null && pointIn(x, y, `${path}.points[${j}]`))
          points.push({ x, y });
      });
    }
    if (points.length < 2) c.err(path, 'needs at least two points');
    else lines.push({ points, width: lineWidth });
  });

  // Walls as plain rectangles (worlds).
  const solids: Solid[] = [];
  c.arr(o.walls, '$.walls').forEach((v, i) => {
    const path = `$.walls[${i}]`;
    const w = c.obj(v, path);
    if (!w) return;
    c.known(w, path, ['x', 'y', 'w', 'h']);
    const r = rectIn(w, path);
    if (r) solids.push({ ...r, kind: 'wall' });
  });

  // Cardboard pieces on the grid (courses).
  const pieces: Piece[] = [];
  /** A thin piece on a cell edge: a full wall (overlapping at corners) or a shorter centred target. */
  const edgeRect = (cell: Rect, edge: Edge, along: number, full: boolean): Rect => {
    const t = WALL_THICKNESS_MM;
    const ext = full ? t : 0;
    if (edge === 'N' || edge === 'S') {
      const y = (edge === 'S' ? cell.y + cell.h : cell.y) - t / 2;
      const x = cell.x + (full ? 0 : (cell.w - along) / 2) - ext / 2;
      return { x, y, w: along + ext, h: t };
    }
    const x = (edge === 'E' ? cell.x + cell.w : cell.x) - t / 2;
    const y = cell.y + (full ? 0 : (cell.h - along) / 2) - ext / 2;
    return { x, y, w: t, h: along + ext };
  };
  c.arr(o.pieces, '$.pieces').forEach((v, i) => {
    const path = `$.pieces[${i}]`;
    const p = c.obj(v, path);
    if (!p) return;
    const kind = c.oneOf(p.piece, `${path}.piece`, ['wall', 'target', 'tunnel'] as const);
    if (!kind) return;
    const cellRef = typeof p.cell === 'string' ? p.cell : '';
    const cell = cellRect(p.cell, `${path}.cell`);
    if (kind === 'wall') {
      c.known(p, path, ['piece', 'cell', 'edge', 'length']);
      const edge = c.oneOf(p.edge, `${path}.edge`, EDGES);
      if (p.length !== undefined && p.length !== 1 && p.length !== 2)
        c.err(`${path}.length`, 'must be 1 or 2 squares');
      const length = p.length === 2 ? 2 : 1;
      if (!cell || !edge || !grid) return;
      const horizontal = edge === 'N' || edge === 'S';
      if (
        length === 2 &&
        (horizontal ? cell.x + 2 * cell.w > width : cell.y + 2 * cell.h > height)
      ) {
        c.err(`${path}.length`, 'goes off the grid');
        return;
      }
      solids.push({ ...edgeRect(cell, edge, grid.cell * length, true), kind: 'wall' });
      pieces.push({ piece: 'wall', cell: cellRef, edge, length });
    } else if (kind === 'target') {
      c.known(p, path, ['piece', 'id', 'cell', 'edge']);
      const tid = claimId(p.id, `${path}.id`);
      const edge = c.oneOf(p.edge, `${path}.edge`, EDGES);
      if (!cell || !edge || !tid) return;
      solids.push({ ...edgeRect(cell, edge, TARGET_LENGTH_MM, false), kind: 'target', id: tid });
      pieces.push({ piece: 'target', id: tid, cell: cellRef, edge });
    } else {
      c.known(p, path, ['piece', 'id', 'cell', 'dir']);
      const tid = claimId(p.id, `${path}.id`);
      const dir = c.oneOf(p.dir, `${path}.dir`, ['ew', 'ns'] as const);
      if (!cell || !tid || !dir) return;
      areas.push({ ...cell, id: tid, light: TUNNEL_LIGHT, pattern: 'checks' });
      pieces.push({ piece: 'tunnel', id: tid, cell: cellRef, dir });
    }
  });

  // Start.
  let start: Pose = { x: 0, y: 0, heading: 0 };
  const so = o.maze !== undefined ? null : c.obj(o.start, '$.start');
  if (so) {
    c.known(so, '$.start', ['x', 'y', 'cell', 'heading']);
    const heading = c.num(so.heading, '$.start.heading', 0, 359.999) ?? 0;
    if (so.cell !== undefined) {
      const r = cellRect(so.cell, '$.start.cell');
      if (r) start = { x: r.x + r.w / 2, y: r.y + r.h / 2, heading };
    } else {
      const x = c.num(so.x, '$.start.x', 0, 20000);
      const y = c.num(so.y, '$.start.y', 0, 20000);
      if (x !== null && y !== null && pointIn(x, y, '$.start')) start = { x, y, heading };
    }
  }

  // Expand the maze.
  if (maze && grid) {
    if (o.start !== undefined) c.err('$.start', 'is set by the maze; leave it out');
    expandMaze(maze, grid, areas, lines, solids, pieces, ids);
    const m = generateMaze(maze.seed, maze.size);
    const heading = isOpenEast(m, 0, 0) ? 0 : 90;
    start = { x: grid.cell / 2, y: grid.cell / 2, heading };
  }

  const areaIds = new Set(areas.flatMap((a) => (a.id ? [a.id] : [])));
  const tunnelIds = new Set(pieces.flatMap((p) => (p.piece === 'tunnel' && p.id ? [p.id] : [])));
  const targetIds = new Set(solids.flatMap((s) => (s.kind === 'target' && s.id ? [s.id] : [])));
  const areaRef = (v: unknown, path: string): string | null => {
    const s = c.str(v, path);
    if (s !== null && !areaIds.has(s)) {
      c.err(path, `no area with id "${s}"`);
      return null;
    }
    return s;
  };

  // Goal (worlds).
  let goal: Goal | null = null;
  if (o.goal !== undefined && o.goal !== null) {
    const g = c.obj(o.goal, '$.goal');
    if (g) {
      c.known(g, '$.goal', ['visit', 'reach', 'stopInside']);
      const visit: string[] = [];
      c.arr(g.visit, '$.goal.visit').forEach((v, i) => {
        const s = areaRef(v, `$.goal.visit[${i}]`);
        if (s) visit.push(s);
      });
      goal = { visit };
      if (g.reach !== undefined) {
        const s = areaRef(g.reach, '$.goal.reach');
        if (s) goal.reach = s;
      }
      if (g.stopInside !== undefined) {
        const s = areaRef(g.stopInside, '$.goal.stopInside');
        if (s) goal.stopInside = s;
      }
      if ((g.reach === undefined) === (g.stopInside === undefined))
        c.err('$.goal', 'needs exactly one of reach or stopInside');
    }
  }

  let timeLimitMs: number | null = null;
  if (o.timeLimitMs !== undefined)
    timeLimitMs = c.num(o.timeLimitMs, '$.timeLimitMs', 1000, 3_600_000, true);
  let noBumps = false;
  if (o.noBumps !== undefined) {
    if (typeof o.noBumps !== 'boolean') c.err('$.noBumps', 'must be true or false');
    else noBumps = o.noBumps;
  }

  // Missions (courses).
  const missions: Mission[] = [];
  const missionIds = new Set<string>();
  c.arr(o.missions, '$.missions').forEach((v, i) => {
    const path = `$.missions[${i}]`;
    const m = c.obj(v, path);
    if (!m) return;
    const mid = c.str(m.id, `${path}.id`, ID_RE, ID_HINT);
    const points = c.num(m.points, `${path}.points`, 0, 1000, true);
    const type = c.oneOf(m.type, `${path}.type`, MISSION_TYPES);
    if (mid && missionIds.has(mid)) c.err(`${path}.id`, `"${mid}" is used twice`);
    if (mid) missionIds.add(mid);
    if (!mid || points === null || !type) return;
    switch (type) {
      case 'reachZone':
      case 'stopInZone':
      case 'returnHome': {
        c.known(m, path, ['id', 'points', 'type', 'zone']);
        const zone = areaRef(m.zone, `${path}.zone`);
        if (zone) missions.push({ id: mid, points, type, zone });
        break;
      }
      case 'checkpoints': {
        c.known(m, path, ['id', 'points', 'type', 'zones']);
        const zones = c
          .arr(m.zones, `${path}.zones`)
          .map((z, j) => areaRef(z, `${path}.zones[${j}]`));
        if (zones.length === 0) c.err(`${path}.zones`, 'needs at least one zone');
        else if (zones.every((z) => z !== null))
          missions.push({ id: mid, points, type, zones: zones as string[] });
        break;
      }
      case 'touchTarget': {
        c.known(m, path, ['id', 'points', 'type', 'target']);
        const t = c.str(m.target, `${path}.target`);
        if (t !== null && !targetIds.has(t))
          c.err(`${path}.target`, `no target piece with id "${t}"`);
        else if (t) missions.push({ id: mid, points, type, target: t });
        break;
      }
      case 'passTunnel': {
        c.known(m, path, ['id', 'points', 'type', 'tunnel']);
        const t = c.str(m.tunnel, `${path}.tunnel`);
        if (t !== null && !tunnelIds.has(t))
          c.err(`${path}.tunnel`, `no tunnel piece with id "${t}"`);
        else if (t) missions.push({ id: mid, points, type, tunnel: t });
        break;
      }
    }
  });
  if (missions.filter((m) => m.type === 'returnHome').length > 1)
    c.err('$.missions', 'can have only one returnHome');
  if (goal && o.missions !== undefined) c.err('$', 'a world has a goal or missions, not both');

  let scoring: Scoring | null = null;
  if (o.scoring !== undefined) {
    const s = c.obj(o.scoring, '$.scoring');
    if (s) {
      c.known(s, '$.scoring', ['timeBonus', 'wallTouch']);
      const timeBonus = c.num(s.timeBonus, '$.scoring.timeBonus', 0, 1000, true);
      const wallTouch = c.num(s.wallTouch, '$.scoring.wallTouch', -1000, 0, true);
      if (timeBonus !== null && wallTouch !== null) scoring = { timeBonus, wallTouch };
      if (timeBonus && timeLimitMs === null && o.timeLimitMs === undefined) {
        c.err('$.scoring.timeBonus', 'needs timeLimitMs');
      }
    }
    if (o.missions === undefined) c.err('$.scoring', 'needs missions');
  }

  if (c.problems.length > 0) return { world: null, problems: c.problems };
  return {
    world: {
      id,
      version,
      challenge,
      width,
      height,
      light,
      grid,
      areas,
      lines,
      solids,
      pieces,
      start,
      bump,
      goal,
      timeLimitMs,
      noBumps,
      missions,
      scoring,
      maze
    },
    problems: []
  };
}

/** Turn a maze into walls (a piece on every closed cell edge) or tape lines (along cell centres). */
function expandMaze(
  maze: NonNullable<World['maze']>,
  grid: Grid,
  areas: Area[],
  lines: Line[],
  solids: Solid[],
  pieces: Piece[],
  ids: Set<string>
): void {
  const m = generateMaze(maze.seed, maze.size);
  const n = maze.size;
  const cell = grid.cell;
  const centre = (c: number, r: number): Point => ({
    x: c * cell + cell / 2,
    y: r * cell + cell / 2
  });
  const zone = (c: number, r: number, id: string, pattern: Pattern): void => {
    const s = 160;
    areas.push({
      id,
      x: c * cell + (cell - s) / 2,
      y: r * cell + (cell - s) / 2,
      w: s,
      h: s,
      pattern
    });
    ids.add(id);
  };
  zone(0, 0, 'start', 'dots');
  zone(n - 1, n - 1, 'finish', 'hatch');
  if (maze.kind === 'lines') {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        for (const [nc, nr] of mazeNeighbours(m, c, r)) {
          if (nc > c || nr > r)
            lines.push({ points: [centre(c, r), centre(nc, nr)], width: LINE_WIDTH_MM });
        }
      }
    }
    return;
  }
  const t = WALL_THICKNESS_MM;
  const addWall = (c: number, r: number, edge: Edge): void => {
    const x = c * cell;
    const y = r * cell;
    const rect: Rect =
      edge === 'N' || edge === 'S'
        ? { x: x - t / 2, y: (edge === 'S' ? y + cell : y) - t / 2, w: cell + t, h: t }
        : { x: (edge === 'E' ? x + cell : x) - t / 2, y: y - t / 2, w: t, h: cell + t };
    solids.push({ ...rect, kind: 'wall' });
    pieces.push({ piece: 'wall', cell: cellName(c, r), edge, length: 1 });
  };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r === 0) addWall(c, r, 'N');
      if (c === 0) addWall(c, r, 'W');
      if (!isOpenEast(m, c, r)) addWall(c, r, 'E');
      if (!isOpenSouth(m, c, r)) addWall(c, r, 'S');
    }
  }
}
