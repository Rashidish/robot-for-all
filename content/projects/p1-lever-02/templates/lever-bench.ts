// Lever bench for "Robot arm with three lever types" (p1-lever-02). Drawn by Claude; reviewed with the lesson.
// A 180 mm beam with marks every 20 mm (0 in the middle, 1-4 each side) and a fold-up triangle stand.
import { defineSheet, shape } from '../../../../packages/templates/src/index';

// Tick marks on the beam: fold-style dashed lines across it, every 20 mm from the centre.
const ticks = [10, 30, 50, 70, 90, 110, 130, 150, 170].map((x) => ({
  x1: x,
  y1: 4,
  x2: x,
  y2: 20
}));

export default defineSheet({
  title: 'Lever bench',
  parts: [
    shape({
      name: 'Beam (marks: 4 3 2 1 0 1 2 3 4)',
      width: 180,
      height: 24,
      path: 'M0 0H180V24H0Z',
      folds: ticks,
      measurements: [
        'beam: 180 × 24 mm (glue two layers together)',
        'draw a line across every 20 mm, starting 10 mm from the left end; the middle line (90 mm) is mark 0'
      ]
    }),
    shape({
      name: 'Stand (fold into a triangle; tape the tab)',
      width: 150,
      height: 50,
      path: 'M0 0H150V50H0Z',
      folds: [
        { x1: 45, y1: 0, x2: 45, y2: 50 },
        { x1: 90, y1: 0, x2: 90, y2: 50 },
        { x1: 135, y1: 0, x2: 135, y2: 50 }
      ],
      measurements: [
        'stand: 150 × 50 mm, folded at 45, 90 and 135 mm into a triangle; the last 15 mm is the tab'
      ]
    })
  ]
});
