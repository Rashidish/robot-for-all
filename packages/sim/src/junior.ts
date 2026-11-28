// Junior (Grades R–2, spec docs/specs/junior.md, ADR-0019): picture-block programs on a grid. A
// program is a row of blocks read left to right after the start flag; "×N" repeats the block after
// it. The robot moves one square per step and turns 90°. Missions are data (content/junior), and
// the build checks each one can be solved in its "fewest blocks" (FR-4). The same program becomes
// robot calls for the real cart (FR-5): one square is SQUARE_MM, a turn is 90°.

export const ACTIONS = [
  'forward',
  'back',
  'left',
  'right',
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
/** At most 20 blocks per program at launch (FR-2). */
export const MAX_BLOCKS = 20;
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
  grid: { cols: number; rows: number };
  start: { cell: string; heading: Heading };
  target: string;
  obstacles: string[];
  /** The blocks offered in the palette. */
  blocks: Block[];
  /** The fewest blocks that solve it (the "best solution" star), checked at build. */
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
  for (const { action, block } of expand(program)) {
    if (action === 'stop') {
      steps.push({ block, action, cell, heading });
      break;
    }
    if (action === 'left' || action === 'right') {
      const i = HEADINGS.indexOf(heading);
      heading = HEADINGS[(i + (action === 'right' ? 1 : 3)) % 4] as Heading;
    } else if (action === 'forward' || action === 'back') {
      const [dx, dy] = STEP[heading];
      const sign = action === 'forward' ? 1 : -1;
      const next = { col: cell.col + dx * sign, row: cell.row + dy * sign };
      const off =
        next.col < 0 ||
        next.row < 0 ||
        next.col >= mission.grid.cols ||
        next.row >= mission.grid.rows;
      if (off || rocks.has(cellName(next))) {
        steps.push({ block, action, cell, heading, blocked: off ? 'edge' : 'rock' });
        outcome = off ? 'off' : 'bumped';
        return { steps, outcome, stars: 0 };
      }
      cell = next;
    }
    steps.push({ block, action, cell, heading });
  }
  if (cell.col === target.col && cell.row === target.row) outcome = 'reached';
  const stars = outcome === 'reached' ? (program.length <= mission.best ? 2 : 1) : 0;
  return { steps, outcome, stars };
}

/**
 * The fewest blocks that reach the target with the mission's blocks, or null if it can't be
 * reached (breadth-first search over squares and headings; "×N" + a move counts as two blocks).
 */
export function fewestBlocks(mission: Mission): number | null {
  const start = parseCell(mission.start.cell);
  const target = parseCell(mission.target);
  if (!start || !target) return null;
  const moves = mission.blocks.filter(
    (b): b is Action => b === 'forward' || b === 'back' || b === 'left' || b === 'right'
  );
  const repeats = [1, ...mission.blocks.map(repeatCount).filter((n) => n > 0)];
  const key = (c: Cell, h: Heading) => `${cellName(c)}${h}`;
  const seen = new Map<string, number>([[key(start, mission.start.heading), 0]]);
  // Costs are 1 or 2, so a simple sorted frontier is enough for boards this small.
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
        const cost = s.cost + program.length;
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
  }
  if (!['rhino-water', 'bee-flower', 'bus-school'].includes(m.theme as string)) {
    p.push(`${id}: theme must be rhino-water, bee-flower or bus-school`);
  }
  if (p.length) return p;
  const fewest = fewestBlocks(m as Mission);
  if (fewest === null) p.push(`${id}: the target can't be reached with these blocks`);
  else if (fewest !== m.best)
    p.push(`${id}: "best" is ${String(m.best)} but the fewest blocks is ${fewest}`);
  else if (fewest > MAX_BLOCKS) p.push(`${id}: needs more than ${MAX_BLOCKS} blocks`);
  return p;
}

export type RobotStep =
  { drive: number } | { turn: 90 | -90 } | { wait: number } | { beep: true } | { light: true };

/** The program as robot calls for the real cart (FR-5): drive whole squares, turn 90°. */
export function robotSteps(program: readonly Block[]): RobotStep[] {
  return expand(program).flatMap(({ action }): RobotStep[] => {
    switch (action) {
      case 'forward':
        return [{ drive: SQUARE_MM }];
      case 'back':
        return [{ drive: -SQUARE_MM }];
      case 'left':
        return [{ turn: -90 as const }];
      case 'right':
        return [{ turn: 90 as const }];
      case 'wait':
        return [{ wait: 1000 }];
      case 'beep':
        return [{ beep: true as const }];
      case 'light':
        return [{ light: true as const }];
      case 'stop':
        return [];
    }
  });
}
