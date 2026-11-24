import { describe, expect, it } from 'vitest';
import bumpMaze from '../../../content/worlds/bump-maze.json';
import followTheLine from '../../../content/worlds/follow-the-line.json';
import rhinoPatrol from '../../../content/worlds/rhino-patrol.json';
import simpleMaze from '../../../content/worlds/simple-maze.json';
import { buildSheet } from './build-sheet';
import { A4_H, A4_W, CALIBRATION_MM, coursePages, type PrintLabels, TILE_H, TILE_W } from './print';
import { buildWorld } from './world';

const labels: PrintLabels = {
  title: 'Bump maze <4817>',
  printAt100: 'Print at 100 %',
  calibration: '100 mm',
  size: 'Size',
  assembly: 'How the tiles join',
  tile: 'Tile',
  tiles: 'tiles',
  buildSheet: 'Build sheet',
  pieces: { wall: 'Wall', target: 'Gate flap', tunnel: 'Tunnel' },
  edges: { N: 'north edge', E: 'east edge', S: 'south edge', W: 'west edge' },
  noPrinter: 'No printer? Draw 200 mm squares with chalk.'
};

describe('build sheet (FR-19)', () => {
  it('lists the same number of wall pieces as the on-screen maze', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const world = buildWorld(bumpMaze, { seed });
      const walls = world.solids.filter((s) => s.kind === 'wall').length;
      expect(buildSheet(world).filter((i) => i.piece === 'wall')).toHaveLength(walls);
    }
  });

  it('names each piece, the square it goes on and its edge', () => {
    const items = buildSheet(buildWorld(rhinoPatrol));
    expect(items).toContainEqual(
      expect.objectContaining({ piece: 'wall', cell: 'B3', edge: 'N', lengthMm: 400 })
    );
    expect(items).toContainEqual(
      expect.objectContaining({ piece: 'target', cell: 'E4', edge: 'S' })
    );
    expect(items).toContainEqual(expect.objectContaining({ piece: 'tunnel', cell: 'A2' }));
  });

  it('lists plain walls of worlds without grid pieces too', () => {
    expect(buildSheet(buildWorld(simpleMaze))).toEqual([
      expect.objectContaining({ piece: 'wall', cell: 'B2', lengthMm: 1000 })
    ]);
  });
});

describe('print course (FR-19)', () => {
  const maze = buildWorld(bumpMaze, { seed: 4817 });
  const pages = coursePages(maze, labels);

  it('a 4 × 4 course prints on about 15 A4 tiles, plus a first page and a build sheet', () => {
    const tiles = Math.ceil(800 / TILE_W) * Math.ceil(800 / TILE_H);
    expect(tiles).toBe(15);
    expect(pages).toHaveLength(1 + tiles + 1);
  });

  it('every page is A4 at true scale (1 unit = 1 mm)', () => {
    for (const p of pages) {
      expect(p).toMatch(
        new RegExp(`^<svg [^>]*width="${A4_W}mm" height="${A4_H}mm" viewBox="0 0 ${A4_W} ${A4_H}"`)
      );
    }
  });

  it('the first page has the 100 mm calibration square and the assembly map', () => {
    expect(pages[0]).toContain(`width="${CALIBRATION_MM}" height="${CALIBRATION_MM}"`);
    expect(pages[0]).toContain('Print at 100 %');
    expect(pages[0]).toContain('How the tiles join');
    expect(pages[0]).toContain('15 tiles');
  });

  it('tiles carry their number, alignment marks and the grid squares they show', () => {
    expect(pages[1]).toContain('Tile 1');
    expect(pages[1]).toContain('>A1<');
    expect(pages[15]).toContain('Tile 15');
    expect(pages[15]).toContain('>D4<');
    expect((pages[1]?.match(/stroke-width="0.3"\/>/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('the build sheet numbers every piece, with its square and edge', () => {
    const sheet = pages[pages.length - 1] ?? '';
    const count = buildSheet(maze).length;
    expect(sheet).toContain(`Build sheet`);
    expect(sheet).toContain(`${count}. Wall 200 mm`);
    expect(sheet).toMatch(/1\. Wall 200 mm — A1, north edge/);
  });

  it('escapes text, and prints no build sheet for a course without cardboard pieces', () => {
    expect(pages[0]).toContain('Bump maze &lt;4817&gt;');
    expect(pages.join('')).not.toContain('<4817>');
    const line = coursePages(buildWorld(followTheLine), labels);
    expect(line[line.length - 1]).not.toContain('Build sheet');
  });
});
