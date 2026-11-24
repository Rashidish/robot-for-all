// The build sheet (M4 spec FR-19, §14.4): every cardboard piece on a course and where it goes,
// in the same order as the numbers printed on the floor tiles. Worlds drawn with plain wall
// rectangles (not grid pieces) list each wall by the square it starts in.
import { cellName, type Piece, type World } from './world';
import type { Rect } from './util';

export interface BuildItem {
  piece: Piece['piece'];
  /** The grid square it stands in or starts from, e.g. "B3". */
  cell: string;
  edge?: Piece['edge'];
  /** Length of a wall (200 or 400 mm for course pieces). */
  lengthMm?: number;
  rect: Rect;
}

export function buildSheet(world: World): BuildItem[] {
  if (world.pieces.length > 0) {
    return world.pieces.map((p) => ({
      piece: p.piece,
      cell: p.cell,
      ...(p.edge ? { edge: p.edge } : {}),
      ...(p.piece === 'wall' ? { lengthMm: (p.length ?? 1) * 200 } : {}),
      rect: p.rect
    }));
  }
  return world.solids
    .filter((s) => s.kind === 'wall')
    .map((s) => ({
      piece: 'wall' as const,
      cell: cellName(Math.floor(Math.max(0, s.x) / 200), Math.floor(Math.max(0, s.y) / 200)),
      lengthMm: Math.round(Math.max(s.w, s.h)),
      rect: { x: s.x, y: s.y, w: s.w, h: s.h }
    }));
}
