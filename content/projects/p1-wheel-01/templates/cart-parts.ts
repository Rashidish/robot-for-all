// Parts for "Rolling cardboard cart" (p1-wheel-01). Drawn by Claude; reviewed with the lesson.
// Cart body folds into a tray (dashed lines); four 55 mm wheels with skewer-sized axle holes.
import { defineSheet, disc, shape } from '../../../../packages/templates/src/index';

const wheel = (n: number) => disc({ name: `Wheel ${n}`, diameter: 55, axleHole: 3 });

export default defineSheet({
  title: 'Rolling cart: parts',
  parts: [
    shape({
      name: 'Cart body (fold up the sides)',
      width: 150,
      height: 100,
      path: 'M20 0H130V20H150V80H130V100H20V80H0V20H20Z',
      folds: [
        { x1: 20, y1: 20, x2: 130, y2: 20 },
        { x1: 20, y1: 80, x2: 130, y2: 80 },
        { x1: 20, y1: 20, x2: 20, y2: 80 },
        { x1: 130, y1: 20, x2: 130, y2: 80 }
      ],
      measurements: [
        'base: rectangle 110 × 60 mm',
        'a 20 mm flap on each of the 4 sides (fold up to make the tray)'
      ]
    }),
    wheel(1),
    wheel(2),
    wheel(3),
    wheel(4)
  ]
});
