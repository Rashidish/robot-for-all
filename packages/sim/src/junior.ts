// Junior (Grades R–2, spec docs/specs/junior.md, ADR-0019): picture-block programs on a grid. A
// program is a row of cards read left to right after the start flag. A repeat number belongs to the
// move card after it (CAPS shows it under the arrow, FR-11): it is stored as "×N" just before the
// card and counts as part of that card. Missions are data (content/junior), and the build checks
// each one can be solved in its "fewest cards" (FR-4). Moves are written one of two ways (FR-10):
// - arrows (CAPS Grades R–1): up, right, down, left; the robot turns itself to face the arrow.
//   "arrows-slide" (Grade R Terms 1–2): one arrow moves until a rock or the edge stops it.
// - turns (CAPS Grade 2): forward, back, turn left, turn right, turn around.
// The same program becomes robot calls for the real cart (FR-5): one square is SQUARE_MM.

/** Direction arrows (CAPS Grades R–1): the robot faces the arrow, then moves. */
export const ARROWS = ['north', 'east', 'south', 'west'] as const;
export type Arrow = (typeof ARROWS)[number];
export const ACTIONS = [
  'forward',
  'back',
  'left',
  'right',
  'around',
  ...ARROWS,
  'wait',
  'beep',
  'light',
  'stop'
] as const;
export type Action = (typeof ACTIONS)[number];
export const REPEATS = ['x2', 'x3', 'x4', 'x5'] as const;
export type Repeat = (typeof REPEATS)[number];
export type Block = Action | Repeat;
export const BLOCKS: readonly Block[] = [...ACTIONS, ...REPEATS];
/** At most 20 cards per program at launch (FR-2); a repeat number is part of its card. */
export const MAX_BLOCKS = 20;
/** Cards that move or turn the robot, and so can carry a repeat number. */
export const MOVES: readonly Action[] = ['forward', 'back', 'left', 'right', 'around', ...ARROWS];

export const MODES = ['arrows', 'arrows-slide', 'turns'] as const;
export type Mode = (typeof MODES)[number];
/** The cards each way of moving may use (FR-10). */
const MODE_BLOCKS: Record<Mode, readonly Block[]> = {
  arrows: [...ARROWS, 'x2', 'x3', 'x4', 'x5', 'wait', 'beep', 'light', 'stop'],
  // Each Grade R card is one action: no repeats (CAPS Table 2.2, C.2).
  'arrows-slide': [...ARROWS, 'wait', 'beep', 'light', 'stop'],
  turns: [
    'forward',
    'back',
    'left',
    'right',
    'around',
    'x2',
    'x3',
    'x4',
    'x5',
    'wait',
    'beep',
    'light',
    'stop'
  ]
};
/** Kinds of mission (FR-12). Only "build" so far; the others come with step 4. */
export const KINDS = ['build'] as const;
export type Kind = (typeof KINDS)[number];
/** CAPS Foundation Phase codes: C.1–C.7 coding, R.1–R.7 robotics, D.1–D.10 digital concepts. */
export const CAPS_CODE = /^(C\.[1-7]|R\.[1-7]|D\.([1-9]|10))$/;
/** One square on the floor (spec §2: like classroom floor robots). */
export const SQUARE_MM = 150;

export type Heading = 'N' | 'E' | 'S' | 'W';
const HEADINGS: Heading[] = ['N', 'E', 'S', 'W'];
const STEP: Record<Heading, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export interface Cell {
  col: number;
  row: number;
}
export interface Mission {
  id: string;
  /** Grades it is for: 0 is Grade R (FR-9). */
  grades: number[];
  /** The CAPS term it fits (1–4). */
  term: number;
  /** CAPS codes it practises, e.g. "C.1", "R.6". */
  caps: string[];
  kind: Kind;
  /** How moves are written (FR-10). */
  mode: Mode;
  grid: { cols: number; rows: number };
  start: { cell: string; heading: Heading };
  target: string;
  obstacles: string[];
  /** The cards offered in the palette. */
  blocks: Block[];
  /** The fewest cards that solve it (the "best solution" star), checked at build. */
  best: number;
  /** The picture theme: what the robot is and what it's going to. */
  theme: 'rhino-water' | 'bee-flower' | 'bus-school';
}

/** "B3" → { col: 1, row: 2 } (columns are letters, rows are numbers, A1 top left). */
export function parseCell(name: string): Cell | null {
  const m = /^([A-F])([1-6])$/.exec(name);
  if (!m || !m[1] || !m[2]) return null;
  return { col: m[1].charCodeAt(0) - 65, row: Number(m[2]) - 1 };
}
export const cellName = (c: Cell): string => `${String.fromCharCode(65 + c.col)}${c.row + 1}`;

const repeatCount = (b: Block): number => (b.startsWith('x') ? Number(b.slice(1)) : 0);
export const isRepeat = (b: Block): b is Repeat => b.startsWith('x');
/** The number of cards in a program: a repeat number is part of its card, not a card itself. */
export const cardCount = (program: readonly Block[]): number =>
  program.filter((b) => !isRepeat(b)).length;
const ARROW_HEADING: Record<Arrow, Heading> = { north: 'N', east: 'E', south: 'S', west: 'W' };
const isArrow = (a: Action): a is Arrow => (ARROWS as readonly string[]).includes(a);

/** The actions a row makes, in order, each with the index of the block that made it. */
export function expand(program: readonly Block[]): { action: Action; block: number }[] {
  const out: { action: Action; block: number }[] = [];
  for (let i = 0; i < program.length; i++) {
    const b = program[i] as Block;
    const n = repeatCount(b);
    if (n > 0) {
      const next = program[i + 1];
      // "×N" repeats the next block; another "×" or nothing after it does nothing.
      if (next === undefined || repeatCount(next) > 0) continue;
      for (let k = 0; k < n; k++) out.push({ action: next as Action, block: i + 1 });
      i++;
      continue;
    }
    out.push({ action: b as Action, block: i });
  }
  return out;
}

export type Outcome = 'reached' | 'bumped' | 'off' | 'not-there';
export interface Step {
  /** The block lit up while this step runs. */
  block: number;
  action: Action;
  cell: Cell;
  heading: Heading;
  /** The robot tried to move into a rock or off the board and stayed put. */
  blocked?: 'rock' | 'edge';
}
export interface Run {
  steps: Step[];
  outcome: Outcome;
  /** 0, 1 (reached) or 2 (reached in the fewest blocks). */
  stars: 0 | 1 | 2;
}

/** Runs a program on a mission: one step per action; a bump ends the run. */
export function runJunior(mission: Mission, program: readonly Block[]): Run {
  const start = parseCell(mission.start.cell);
  const target = parseCell(mission.target);
  if (!start || !target) throw new Error(`mission ${mission.id}: bad start or target`);
  const rocks = new Set(mission.obstacles);
  let cell = start;
  let heading = mission.start.heading;
  const steps: Step[] = [];
  let outcome: Outcome = 'not-there';
  const blocked = (next: Cell): 'edge' | 'rock' | null =>
    next.col < 0 || next.row < 0 || next.col >= mission.grid.cols || next.row >= mission.grid.rows
      ? 'edge'
      : rocks.has(cellName(next))
        ? 'rock'
        : null;
  for (const { action, block } of expand(program)) {
    if (action === 'stop') {
      steps.push({ block, action, cell, heading });
      break;
    }
    if (action === 'left' || action === 'right' || action === 'around') {
      const i = HEADINGS.indexOf(heading);
      const by = action === 'right' ? 1 : action === 'left' ? 3 : 2;
      heading = HEADINGS[(i + by) % 4] as Heading;
    } else if (action === 'forward' || action === 'back' || isArrow(action)) {
      const arrow = isArrow(action);
      if (isArrow(action)) heading = ARROW_HEADING[action];
      const [dx, dy] = STEP[heading];
      const sign = action === 'back' ? -1 : 1;
      const slide = arrow && mission.mode === 'arrows-slide';
      let moved = false;
      for (;;) {
        const next = { col: cell.col + dx * sign, row: cell.row + dy * sign };
        const hit = blocked(next);
        if (hit && slide) break; // Grade R: an arrow moves until something stops it.
        if (hit) {
          steps.push({ block, action, cell, heading, blocked: hit });
          outcome = hit === 'edge' ? 'off' : 'bumped';
          return { steps, outcome, stars: 0 };
        }
        cell = next;
        moved = true;
        if (!slide) break;
        steps.push({ block, action, cell, heading });
      }
      if (slide) {
        // Facing the arrow even when it couldn't move: show the turn.
        if (!moved) steps.push({ block, action, cell, heading });
        continue;
      }
    }
    steps.push({ block, action, cell, heading });
  }
  if (cell.col === target.col && cell.row === target.row) outcome = 'reached';
  const stars = outcome === 'reached' ? (cardCount(program) <= mission.best ? 2 : 1) : 0;
  return { steps, outcome, stars };
}

/**
 * The fewest cards that reach the target with the mission's cards, or null if it can't be reached
 * (search over squares and headings; a card with its repeat number counts as one card).
 */
export function fewestBlocks(mission: Mission): number | null {
  const start = parseCell(mission.start.cell);
  const target = parseCell(mission.target);
  if (!start || !target) return null;
  const moves = mission.blocks.filter((b): b is Action => MOVES.includes(b as Action));
  const repeats = [1, ...mission.blocks.map(repeatCount).filter((n) => n > 0)];
  const key = (c: Cell, h: Heading) => `${cellName(c)}${h}`;
  const seen = new Map<string, number>([[key(start, mission.start.heading), 0]]);
  // Every card costs 1, so a simple sorted frontier is enough for boards this small.
  const frontier: { cell: Cell; heading: Heading; cost: number }[] = [
    { cell: start, heading: mission.start.heading, cost: 0 }
  ];
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const s = frontier.shift();
    if (!s) break;
    if (s.cell.col === target.col && s.cell.row === target.row) return s.cost;
    for (const move of moves) {
      for (const n of repeats) {
        const program: Block[] = n > 1 ? [`x${n}` as Repeat, move] : [move];
        const run = runJunior(
          { ...mission, start: { cell: cellName(s.cell), heading: s.heading } },
          program
        );
        if (run.outcome === 'bumped' || run.outcome === 'off') continue;
        const last = run.steps.at(-1);
        if (!last) continue;
        const cost = s.cost + 1;
        const k = key(last.cell, last.heading);
        if ((seen.get(k) ?? Infinity) <= cost) continue;
        seen.set(k, cost);
        frontier.push({ cell: last.cell, heading: last.heading, cost });
      }
    }
  }
  return null;
}

/** Problems with a mission file (the build fails on any). */
export function missionProblems(raw: unknown, id: string): string[] {
  const p: string[] = [];
  const m = raw as Partial<Mission>;
  if (!m || typeof m !== 'object') return [`${id}: not an object`];
  if (m.id !== id) p.push(`${id}: "id" must be the file name`);
  if (
    !Array.isArray(m.grades) ||
    m.grades.length === 0 ||
    !m.grades.every((g) => Number.isInteger(g) && g >= 0 && g <= 3)
  ) {
    p.push(`${id}: grades must be a list of 0 (Grade R) to 3`);
  }
  if (!Number.isInteger(m.term) || (m.term as number) < 1 || (m.term as number) > 4) {
    p.push(`${id}: term must be 1 to 4`);
  }
  if (!Array.isArray(m.caps) || m.caps.length === 0) {
    p.push(`${id}: caps must list at least one CAPS code, e.g. "C.1"`);
  } else {
    for (const code of m.caps) {
      if (typeof code !== 'string' || !CAPS_CODE.test(code)) {
        p.push(
          `${id}: "${String(code)}" is not a Foundation Phase CAPS code (C.1–7, R.1–7, D.1–10)`
        );
      }
    }
  }
  if (!KINDS.includes(m.kind as Kind)) p.push(`${id}: kind must be ${KINDS.join(', ')}`);
  if (!MODES.includes(m.mode as Mode)) p.push(`${id}: mode must be ${MODES.join(', ')}`);
  const g = m.grid;
  if (
    !g ||
    !Number.isInteger(g.cols) ||
    !Number.isInteger(g.rows) ||
    g.cols < 3 ||
    g.rows < 3 ||
    g.cols > 6 ||
    g.rows > 6
  ) {
    p.push(`${id}: grid must be 3×3 to 6×6`);
  }
  const inGrid = (name: unknown) => {
    const c = typeof name === 'string' ? parseCell(name) : null;
    return c !== null && g !== undefined && c.col < g.cols && c.row < g.rows;
  };
  if (!m.start || !inGrid(m.start.cell) || !HEADINGS.includes(m.start.heading as Heading)) {
    p.push(`${id}: start needs a cell on the board and a heading N, E, S or W`);
  }
  if (!inGrid(m.target)) p.push(`${id}: target must be a cell on the board`);
  if (!Array.isArray(m.obstacles) || !m.obstacles.every(inGrid)) {
    p.push(`${id}: obstacles must be cells on the board`);
  } else if (
    m.obstacles.includes(m.target as string) ||
    m.obstacles.includes(m.start?.cell as string)
  ) {
    p.push(`${id}: no rock on the start or the target`);
  }
  if (
    !Array.isArray(m.blocks) ||
    m.blocks.length === 0 ||
    !m.blocks.every((b) => BLOCKS.includes(b))
  ) {
    p.push(`${id}: blocks must be from ${BLOCKS.join(', ')}`);
  } else if (MODES.includes(m.mode as Mode)) {
    const allowed = MODE_BLOCKS[m.mode as Mode];
    const wrong = m.blocks.filter((b) => !allowed.includes(b));
    if (wrong.length) p.push(`${id}: ${String(m.mode)} missions can't use ${wrong.join(', ')}`);
  }
  if (!['rhino-water', 'bee-flower', 'bus-school'].includes(m.theme as string)) {
    p.push(`${id}: theme must be rhino-water, bee-flower or bus-school`);
  }
  if (p.length) return p;
  const fewest = fewestBlocks(m as Mission);
  if (fewest === null) p.push(`${id}: the target can't be reached with these blocks`);
  else if (fewest !== m.best)
    p.push(`${id}: "best" is ${String(m.best)} but the fewest cards is ${fewest}`);
  else if (fewest > MAX_BLOCKS) p.push(`${id}: needs more than ${MAX_BLOCKS} cards`);
  return p;
}

export type RobotStep =
  { drive: number } | { turn: 90 | -90 } | { wait: number } | { beep: true } | { light: true };

/**
 * The program as robot calls for the real cart (FR-5): drive whole squares, turn 90°. Worked out
 * from the run itself, so direction arrows and Grade R slides become "turn to face, then drive".
 */
export function robotSteps(mission: Mission, program: readonly Block[]): RobotStep[] {
  const out: RobotStep[] = [];
  let cell = parseCell(mission.start.cell) ?? { col: 0, row: 0 };
  let heading = mission.start.heading;
  for (const step of runJunior(mission, program).steps) {
    if (step.action === 'wait') out.push({ wait: 1000 });
    if (step.action === 'beep') out.push({ beep: true });
    if (step.action === 'light') out.push({ light: true });
    const turn = (HEADINGS.indexOf(step.heading) - HEADINGS.indexOf(heading) + 4) % 4;
    if (turn === 1) out.push({ turn: 90 });
    if (turn === 3) out.push({ turn: -90 });
    if (turn === 2) out.push({ turn: 90 }, { turn: 90 });
    heading = step.heading;
    const moved = Math.abs(step.cell.col - cell.col) + Math.abs(step.cell.row - cell.row);
    if (moved > 0) out.push({ drive: step.action === 'back' ? -SQUARE_MM : SQUARE_MM });
    cell = step.cell;
  }
  return out;
}
