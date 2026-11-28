// Junior grid programs (spec docs/specs/junior.md FR-2 to FR-5).
import { describe, expect, it } from 'vitest';
import {
  type Block,
  expand,
  fewestBlocks,
  type Mission,
  missionProblems,
  robotSteps,
  runJunior
} from './junior';

const water: Mission = {
  id: 'rhino-to-water',
  grid: { cols: 4, rows: 4 },
  start: { cell: 'A1', heading: 'E' },
  target: 'D4',
  obstacles: ['B2'],
  blocks: ['forward', 'left', 'right', 'x3'],
  best: 5,
  theme: 'rhino-water'
};

describe('expand', () => {
  it('×N repeats the next block; a repeat with nothing (or another repeat) after it does nothing', () => {
    expect(expand(['x3', 'forward', 'right']).map((s) => s.action)).toEqual([
      'forward',
      'forward',
      'forward',
      'right'
    ]);
    expect(expand(['x3', 'forward']).map((s) => s.block)).toEqual([1, 1, 1]);
    expect(expand(['x2', 'x3', 'forward']).map((s) => s.action)).toEqual([
      'forward',
      'forward',
      'forward'
    ]);
    expect(expand(['forward', 'x4'])).toEqual([{ action: 'forward', block: 0 }]);
  });
});

describe('runJunior', () => {
  it('a program with repeat moves exactly the planned squares and turns', () => {
    const run = runJunior(water, ['x3', 'forward', 'right', 'x3', 'forward']);
    expect(run.outcome).toBe('reached');
    expect(run.stars).toBe(2);
    expect(
      run.steps.map(
        (s) => `${s.action}:${String.fromCharCode(65 + s.cell.col)}${s.cell.row + 1}${s.heading}`
      )
    ).toEqual([
      'forward:B1E',
      'forward:C1E',
      'forward:D1E',
      'right:D1S',
      'forward:D2S',
      'forward:D3S',
      'forward:D4S'
    ]);
    // The lit block for each step: the repeated block, not the "×".
    expect(run.steps.map((s) => s.block)).toEqual([1, 1, 1, 2, 4, 4, 4]);
  });

  it('reaching the target in more blocks than the best gets one star', () => {
    const long: Block[] = [
      'forward',
      'forward',
      'forward',
      'right',
      'forward',
      'forward',
      'forward'
    ];
    expect(runJunior(water, long)).toMatchObject({ outcome: 'reached', stars: 1 });
  });

  it('bumping a rock or the edge stops the robot where it is', () => {
    const rock = runJunior(water, ['forward', 'right', 'forward', 'forward']);
    expect(rock.outcome).toBe('bumped');
    expect(rock.steps.at(-1)).toMatchObject({ blocked: 'rock', cell: { col: 1, row: 0 } });
    expect(runJunior(water, ['left', 'forward']).outcome).toBe('off');
    expect(runJunior(water, ['forward']).outcome).toBe('not-there');
    expect(runJunior(water, ['stop', 'x3', 'forward']).steps).toHaveLength(1);
  });
});

describe('missions', () => {
  it('finds the fewest blocks, counting ×N and its block as two', () => {
    expect(fewestBlocks(water)).toBe(5);
    expect(fewestBlocks({ ...water, blocks: ['forward', 'right'] })).toBe(7);
    expect(fewestBlocks({ ...water, blocks: ['forward'] })).toBeNull();
  });

  it('a mission file must be solvable in its "best"', () => {
    expect(missionProblems(water, 'rhino-to-water')).toEqual([]);
    expect(missionProblems({ ...water, best: 4 }, 'rhino-to-water')).toEqual([
      'rhino-to-water: "best" is 4 but the fewest blocks is 5'
    ]);
    expect(missionProblems({ ...water, blocks: ['forward'] }, 'rhino-to-water')).toEqual([
      "rhino-to-water: the target can't be reached with these blocks"
    ]);
    expect(missionProblems({ ...water, obstacles: ['D4'] }, 'rhino-to-water')).toEqual([
      'rhino-to-water: no rock on the start or the target'
    ]);
    expect(missionProblems({ ...water, grid: { cols: 9, rows: 4 } }, 'x').length).toBeGreaterThan(
      0
    );
  });

  it('the same program as robot calls for the real cart: whole squares and 90° turns', () => {
    expect(robotSteps(['x2', 'forward', 'left', 'back', 'beep'])).toEqual([
      { drive: 150 },
      { drive: 150 },
      { turn: -90 },
      { drive: -150 },
      { beep: true }
    ]);
  });
});
