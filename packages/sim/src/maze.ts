// Seeded random mazes (FR-18): one maze number and size give exactly one maze, on every device.
// A depth-first "perfect maze": exactly one path between any two cells, so it is always solvable.
import { mulberry32 } from './util';

export const MAZE_MIN = 3;
export const MAZE_MAX = 6;

export interface Maze {
  size: number;
  seed: number;
  /** openEast[row * size + col]: no wall between (col,row) and (col+1,row). */
  openEast: boolean[];
  /** openSouth[row * size + col]: no wall between (col,row) and (col,row+1). */
  openSouth: boolean[];
}

export function generateMaze(seed: number, size: number): Maze {
  if (!Number.isInteger(size) || size < MAZE_MIN || size > MAZE_MAX) {
    throw new RangeError(`maze size must be ${MAZE_MIN}–${MAZE_MAX}`);
  }
  if (!Number.isInteger(seed) || seed < 0)
    throw new RangeError('maze number must be a whole number, 0 or more');
  const rand = mulberry32(seed);
  const cells = size * size;
  const m: Maze = {
    size,
    seed,
    openEast: Array<boolean>(cells).fill(false),
    openSouth: Array<boolean>(cells).fill(false)
  };
  const seen = Array<boolean>(cells).fill(false);
  const stack: number[] = [0];
  seen[0] = true;
  while (stack.length > 0) {
    const here = stack[stack.length - 1] ?? 0;
    const c = here % size;
    const r = Math.floor(here / size);
    const next = [
      r > 0 ? here - size : -1,
      c < size - 1 ? here + 1 : -1,
      r < size - 1 ? here + size : -1,
      c > 0 ? here - 1 : -1
    ].filter((n) => n >= 0 && seen[n] !== true);
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const there = next[Math.floor(rand() * next.length)] ?? 0;
    if (there === here + 1) m.openEast[here] = true;
    else if (there === here - 1) m.openEast[there] = true;
    else if (there === here + size) m.openSouth[here] = true;
    else m.openSouth[there] = true;
    seen[there] = true;
    stack.push(there);
  }
  return m;
}

export function isOpenEast(m: Maze, col: number, row: number): boolean {
  return col < m.size - 1 && m.openEast[row * m.size + col] === true;
}

export function isOpenSouth(m: Maze, col: number, row: number): boolean {
  return row < m.size - 1 && m.openSouth[row * m.size + col] === true;
}

/** Neighbours of a cell that are joined to it (no wall between), as [col, row]. */
export function mazeNeighbours(m: Maze, col: number, row: number): [number, number][] {
  const out: [number, number][] = [];
  if (row > 0 && isOpenSouth(m, col, row - 1)) out.push([col, row - 1]);
  if (isOpenEast(m, col, row)) out.push([col + 1, row]);
  if (isOpenSouth(m, col, row)) out.push([col, row + 1]);
  if (col > 0 && isOpenEast(m, col - 1, row)) out.push([col - 1, row]);
  return out;
}

/** Number of steps on the path from the start (top-left) to the finish (bottom-right), or -1 if none. */
export function mazePathLength(m: Maze): number {
  const dist = new Map<number, number>([[0, 0]]);
  const queue: [number, number][] = [[0, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [c, r] = queue[i] ?? [0, 0];
    const d = dist.get(r * m.size + c) ?? 0;
    if (c === m.size - 1 && r === m.size - 1) return d;
    for (const [nc, nr] of mazeNeighbours(m, c, r)) {
      const key = nr * m.size + nc;
      if (!dist.has(key)) {
        dist.set(key, d + 1);
        queue.push([nc, nr]);
      }
    }
  }
  return -1;
}
