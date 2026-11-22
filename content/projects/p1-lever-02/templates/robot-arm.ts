// Robot arm for "Robot arm with three lever types" (p1-lever-02). Drawn by Claude; reviewed with the lesson.
// A fold-up square tower on a base, and an arm with a pivot hole, two effort holes and a gripper hole.
import { defineSheet, shape, strip } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Robot arm: parts',
  parts: [
    shape({
      name: 'Tower (fold into a square tube)',
      width: 110,
      height: 120,
      path: 'M0 0H110V120H0Z',
      folds: [
        { x1: 25, y1: 0, x2: 25, y2: 120 },
        { x1: 50, y1: 0, x2: 50, y2: 120 },
        { x1: 75, y1: 0, x2: 75, y2: 120 },
        { x1: 100, y1: 0, x2: 100, y2: 120 }
      ],
      holes: [
        { x: 12.5, y: 10, d: 4 },
        { x: 62.5, y: 10, d: 4 }
      ],
      measurements: [
        'tower: 110 × 120 mm, folded every 25 mm into a square tube; the last 10 mm is the glue tab',
        'pivot holes 10 mm from the top, in the middle of two opposite faces'
      ]
    }),
    shape({
      name: 'Base',
      width: 70,
      height: 70,
      path: 'M0 0H70V70H0Z',
      measurements: ['base: 70 × 70 mm square; tape the tower in the middle']
    }),
    strip({ name: 'Arm (pivot, effort, effort, gripper holes)', length: 160, width: 18, holes: 4 })
  ]
});
