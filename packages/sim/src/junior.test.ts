// Junior grid programs (spec docs/specs/junior.md FR-2 to FR-5).
import { describe, expect, it } from 'vitest';
import {
  type Block,
  cardCount,
  expand,
  fewestBlocks,
  type Mission,
  missionProblems,
  robotSteps,
  runJunior
} from './junior';

const water: Mission = {
  id: 'rhino-to-water',
  grades: [2],
  term: 2,
  caps: ['C.1', 'C.2'],
  kind: 'build',
  mode: 'turns',
  grid: { cols: 4, rows: 4 },
  start: { cell: 'A1', heading: 'E' },
  target: 'D4',
  obstacles: ['B2'],
  blocks: ['forward', 'left', 'right', 'x3'],
  best: 3,
  theme: 'rhino-water'
};
// CAPS Grade R Terms 1–2 (FR-10): one arrow moves until a rock or the edge stops it.
const slide: Mission = {
  ...water,
  id: 'bee',
  grades: [0],
  term: 1,
  mode: 'arrows-slide',
  grid: { cols: 3, rows: 3 },
  obstacles: ['B3'],
  target: 'C3',
  blocks: ['north', 'east', 'south', 'west'],
  best: 2
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

describe('CAPS ways of moving (FR-10)', () => {
  it('Grade R slide: one arrow moves until a rock or the edge stops it, with no bump', () => {
    // East from A1 slides to C1 (the edge); south slides to C3.
    const run = runJunior(slide, ['east', 'south']);
    expect(run.outcome).toBe('reached');
    expect(run.stars).toBe(2);
    expect(run.steps.map((s) => s.block)).toEqual([0, 0, 1, 1]);
    // South slides to A3; then east is stopped by the rock at B3 straight away, so the bee only
    // turns to face it.
    const stopped = runJunior(slide, ['south', 'east']);
    expect(stopped.outcome).toBe('not-there');
    expect(stopped.steps.at(-1)).toMatchObject({ cell: { col: 0, row: 2 }, heading: 'E' });
  });

  it('Grades R–1 arrows: the robot faces the arrow and moves one square; repeats count', () => {
    const arrows: Mission = {
      ...water,
      mode: 'arrows',
      blocks: ['north', 'east', 'south', 'west', 'x3']
    };
    const run = runJunior(arrows, ['x3', 'east', 'x3', 'south']);
    expect(run).toMatchObject({ outcome: 'reached', stars: 2 });
    expect(fewestBlocks(arrows)).toBe(2);
    expect(runJunior(arrows, ['south', 'east']).outcome).toBe('bumped');
  });

  it('Grade 2 turns: turn around faces the other way', () => {
    const run = runJunior(water, ['around', 'forward']);
    expect(run.steps[0]?.heading).toBe('W');
    expect(run.outcome).toBe('off');
  });
});

describe('missions', () => {
  it('finds the fewest cards, a repeat number being part of its card (FR-11)', () => {
    expect(cardCount(['x3', 'forward', 'right'])).toBe(2);
    expect(fewestBlocks(water)).toBe(3);
    expect(fewestBlocks({ ...water, blocks: ['forward', 'right'] })).toBe(7);
    expect(fewestBlocks({ ...water, blocks: ['forward'] })).toBeNull();
  });

  it('a mission file must be solvable in its "best"', () => {
    expect(missionProblems(water, 'rhino-to-water')).toEqual([]);
    expect(missionProblems({ ...water, best: 4 }, 'rhino-to-water')).toEqual([
      'rhino-to-water: "best" is 4 but the fewest cards is 3'
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

  it('a mission says its grades, term, CAPS codes, kind and way of moving (FR-9, FR-10)', () => {
    expect(missionProblems(slide, 'bee')).toEqual([]);
    expect(missionProblems({ ...water, caps: ['C.9', 'R.6'] }, 'rhino-to-water')).toEqual([
      'rhino-to-water: "C.9" is not a Foundation Phase CAPS code (C.1–7, R.1–7, D.1–10)'
    ]);
    expect(missionProblems({ ...water, caps: [] }, 'rhino-to-water')).toHaveLength(1);
    expect(missionProblems({ ...water, grades: [7] }, 'rhino-to-water')).toHaveLength(1);
    expect(missionProblems({ ...water, term: 5 }, 'rhino-to-water')).toHaveLength(1);
    // Arrows missions use arrows; Grade R slides have no repeats (one card, one action).
    expect(missionProblems({ ...water, mode: 'arrows' }, 'rhino-to-water')[0]).toContain(
      "arrows missions can't use forward, left, right"
    );
    expect(missionProblems({ ...slide, blocks: ['east', 'south', 'x2'] }, 'bee')[0]).toContain(
      "can't use x2"
    );
  });

  it('the same program as robot calls for the real cart: whole squares and 90° turns', () => {
    expect(robotSteps(water, ['x2', 'forward', 'left', 'back', 'beep'])).toEqual([
      { drive: 150 },
      { drive: 150 },
      { turn: -90 },
      { drive: -150 },
      { beep: true }
    ]);
    // Arrows become "turn to face, then drive"; a slide drives every square it moves.
    expect(robotSteps(slide, ['south', 'east'])).toEqual([
      { turn: 90 },
      { drive: 150 },
      { drive: 150 },
      { turn: -90 }
    ]);
  });
});
