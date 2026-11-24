import { describe, expect, it } from 'vitest';
import {
  buildWorld,
  cellAt,
  checkWorld,
  parseCell,
  WorldError,
  worldHash,
  worldReview
} from './world';

const base = {
  id: 'test',
  version: 1,
  challenge: null,
  size: { w: 1000, h: 800 },
  start: { x: 100, y: 100, heading: 0 }
};

describe('world format (FR-4)', () => {
  it('accepts a small valid world', () => {
    expect(checkWorld(base)).toEqual([]);
    const w = buildWorld(base);
    expect(w).toMatchObject({
      width: 1000,
      height: 800,
      light: 200,
      bump: 'shake',
      goal: null,
      missions: []
    });
  });

  it('rejects a world with mistakes, with the path to each problem', () => {
    const problems = checkWorld({
      id: 'Bad_Id',
      version: 1,
      challenge: 'not a key',
      size: { w: 1000, h: 800 },
      colour: 'red',
      areas: [
        { id: 'zone', x: 0, y: 0, w: 100, h: 100 },
        { id: 'zone', x: 0, y: 0, w: 10, h: 10, pattern: 'stripes' },
        { x: 900, y: 0, w: 200, h: 100 }
      ],
      lines: [{ points: [[0, 0]] }],
      start: { x: 5000, y: 100, heading: 0 },
      goal: { reach: 'nowhere' },
      timeLimitMs: 5
    });
    const paths = problems.map((p) => p.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '$.id',
        '$.challenge',
        '$.colour',
        '$.areas[1].id',
        '$.areas[2]',
        '$.areas[1].pattern',
        '$.lines[0]',
        '$.start',
        '$.goal.reach',
        '$.timeLimitMs'
      ])
    );
    expect(() => buildWorld({ ...base, size: null })).toThrow(WorldError);
    try {
      buildWorld({ ...base, size: { w: 1000, h: 'big' } });
    } catch (e) {
      expect((e as WorldError).problems).toEqual([
        { path: '$.size.h', message: 'must be a number' }
      ]);
    }
  });

  it('rejects a goal and missions together, and missions that point at nothing', () => {
    const problems = checkWorld({
      ...base,
      areas: [{ id: 'zone', x: 0, y: 0, w: 100, h: 100 }],
      goal: { reach: 'zone' },
      missions: [
        { id: 'a', type: 'reachZone', zone: 'zone', points: 10 },
        { id: 'b', type: 'touchTarget', target: 'gate', points: 10 },
        { id: 'c', type: 'teleport', points: 10 }
      ]
    }).map((p) => p.path);
    expect(problems).toEqual(
      expect.arrayContaining(['$', '$.missions[1].target', '$.missions[2].type'])
    );
  });

  it('the fingerprint changes when the world changes', () => {
    const a = worldHash(buildWorld(base));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(worldHash(buildWorld(base))).toBe(a);
    expect(worldHash(buildWorld({ ...base, version: 2 }))).not.toBe(a);
  });
});

describe('courses (FR-16)', () => {
  const course = {
    id: 'course',
    version: 1,
    challenge: null,
    grid: { cols: 4, rows: 3 },
    lines: [{ cells: ['A2', 'B2', 'C2'] }],
    pieces: [
      { piece: 'wall', cell: 'B1', edge: 'E', length: 2 },
      { piece: 'target', id: 'gate', cell: 'D3', edge: 'S' },
      { piece: 'tunnel', id: 'thicket', cell: 'C2', dir: 'ew' }
    ],
    areas: [
      { id: 'home', cell: 'A2' },
      { id: 'field', cell: 'C1', span: [2, 1] }
    ],
    start: { cell: 'A2', heading: 0 },
    missions: [
      { id: 'gate', type: 'touchTarget', target: 'gate', points: 30 },
      { id: 'thicket', type: 'passTunnel', tunnel: 'thicket', points: 20 }
    ]
  };

  it('places lines, pieces and zones on 200 mm cells', () => {
    const w = buildWorld(course);
    expect(w.width).toBe(800);
    expect(w.height).toBe(600);
    expect(w.start).toEqual({ x: 100, y: 300, heading: 0 });
    expect(w.lines[0]?.points).toEqual([
      { x: 100, y: 300 },
      { x: 300, y: 300 },
      { x: 500, y: 300 }
    ]);
    expect(w.solids[0]).toEqual({ x: 395, y: -5, w: 10, h: 410, kind: 'wall' });
    expect(w.solids[1]).toMatchObject({ kind: 'target', id: 'gate', y: 595, w: 120 });
    expect(w.areas.find((a) => a.id === 'thicket')).toMatchObject({
      x: 400,
      y: 200,
      w: 200,
      h: 200,
      light: 20
    });
    expect(w.areas.find((a) => a.id === 'field')).toMatchObject({ x: 400, y: 0, w: 400, h: 200 });
  });

  it('either layer alone is a valid course', () => {
    expect(checkWorld({ ...course, pieces: [], missions: [] })).toEqual([]);
    expect(
      checkWorld({
        ...course,
        lines: [],
        pieces: [{ piece: 'wall', cell: 'A1', edge: 'S' }],
        missions: []
      })
    ).toEqual([]);
  });

  it('rejects squares off the grid and pieces that run off it', () => {
    const paths = checkWorld({
      ...course,
      pieces: [
        { piece: 'wall', cell: 'E1', edge: 'N' },
        { piece: 'wall', cell: 'D1', edge: 'N', length: 2 }
      ],
      missions: []
    }).map((p) => p.path);
    expect(paths).toEqual(['$.pieces[0].cell', '$.pieces[1].length']);
  });

  it('names grid squares: columns are letters, rows are numbers from the top', () => {
    const w = buildWorld(course);
    expect(parseCell('C4')).toEqual({ col: 2, row: 3 });
    expect(parseCell('c4')).toBeNull();
    expect(cellAt(w, { x: 1, y: 1 })).toBe('A1');
    expect(cellAt(w, { x: 799, y: 599 })).toBe('D3');
    expect(cellAt(w, { x: 450, y: 250 })).toBe('C2');
    expect(cellAt(w, { x: 900, y: 0 })).toBeNull();
  });
});

describe('random maze courses (FR-18)', () => {
  const maze = (kind: string) => ({
    id: 'maze',
    version: 1,
    challenge: null,
    maze: { kind, size: 4 }
  });

  it('the same maze number gives the same world; another number gives another', () => {
    expect(buildWorld(maze('walls'), { seed: 4817 })).toEqual(
      buildWorld(maze('walls'), { seed: 4817 })
    );
    expect(worldHash(buildWorld(maze('walls'), { seed: 1 }))).not.toBe(
      worldHash(buildWorld(maze('walls'), { seed: 2 }))
    );
  });

  it('a wall maze has one wall piece per closed edge, listed for the build sheet', () => {
    const w = buildWorld(maze('walls'), { seed: 7 });
    // 4×4 perfect maze: 40 edges in all (16 outside + 24 inside), 15 of them open.
    expect(w.pieces).toHaveLength(40 - 15);
    expect(w.solids.filter((s) => s.kind === 'wall')).toHaveLength(w.pieces.length);
  });

  it('a line maze draws one line per open edge', () => {
    const w = buildWorld(maze('lines'), { seed: 7, mazeSize: 6 });
    expect(w.grid).toEqual({ cols: 6, rows: 6, cell: 200 });
    expect(w.lines).toHaveLength(35);
    expect(w.solids).toHaveLength(0);
  });

  it('starts in A1 facing an open way, with the finish in the far corner', () => {
    const w = buildWorld(maze('lines'), { seed: 3 });
    expect([0, 90]).toContain(w.start.heading);
    expect(w.areas.find((a) => a.id === 'finish')).toMatchObject({ x: 620, y: 620 });
  });

  it('rejects a maze size outside 3–6', () => {
    expect(checkWorld(maze('walls'), { mazeSize: 9 }).map((p) => p.path)).toEqual(['mazeSize']);
  });
});

describe('world review status (more content spec §2.2)', () => {
  const base = {
    id: 'tiny-world',
    version: 1,
    challenge: null,
    size: { w: 400, h: 400 },
    start: { x: 200, y: 200, heading: 0 }
  };

  it('is optional for the engine and kept out of the world and its fingerprint', () => {
    const plain = buildWorld(base);
    const reviewed = buildWorld({
      ...base,
      status: 'published',
      reviewed_by: 'R. Ishmail',
      build_tested_by: null
    });
    expect(worldHash(plain)).toBe(worldHash(reviewed));
    expect(worldReview(base)).toEqual({ status: 'draft', reviewedBy: null, buildTestedBy: null });
    expect(worldReview({ ...base, status: 'published', reviewed_by: 'R. Ishmail' })).toEqual({
      status: 'published',
      reviewedBy: 'R. Ishmail',
      buildTestedBy: null
    });
  });

  it('refuses a published world without a reviewer, an unknown status and a bad name', () => {
    expect(
      checkWorld({ ...base, status: 'published', reviewed_by: null }).map((p) => p.path)
    ).toContain('$.reviewed_by');
    expect(checkWorld({ ...base, status: 'live' }).map((p) => p.path)).toContain('$.status');
    expect(
      checkWorld({ ...base, status: 'draft', build_tested_by: 'x' }).map((p) => p.path)
    ).toContain('$.build_tested_by');
  });
});
