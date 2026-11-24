// Course wall pieces for "Bump maze" (p2-maze-01) and every printed course (M4 spec §14.4).
// Drawn by Claude; reviewed with the lesson. A wall is 200 mm long and 60 mm high; the 30 mm
// base folds back into an L so it stands by itself (tape or Prestik it to the floor). A 400 mm
// wall is two pieces joined with the 15 mm end tab. Print this sheet once and trace the stencil
// onto cereal-box card for every wall the build sheet lists (saves paper and ink).
import { defineSheet, shape } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Course wall piece (stencil: trace one for each wall)',
  parts: [
    shape({
      name: 'Wall piece (fold the base into an L)',
      width: 90,
      height: 215,
      // 60 mm wall + 30 mm base, 200 mm long, plus a 15 mm end tab to join two pieces.
      path: 'M0 0H90V200H60V215H0Z',
      folds: [
        { x1: 60, y1: 0, x2: 60, y2: 200 },
        { x1: 0, y1: 200, x2: 60, y2: 200 }
      ],
      measurements: [
        'wall: 200 mm long, 60 mm high, with a 30 mm base folded back (an L)',
        'end tab: 15 mm, to join two pieces into a 400 mm wall'
      ]
    })
  ]
});
