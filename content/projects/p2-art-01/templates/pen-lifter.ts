// Parts for "Pen art" (p2-art-01). Drawn by Claude; reviewed with the lesson.
// The pen stands in a card sleeve over a hole in the middle of the cart, halfway between the
// wheels, so a turn on the spot draws a corner, not a curve. A card collar on the pen rests on
// the servo arm: the servo lifts the collar (pen up) or lets the pen drop under its own weight
// (pen down). The servo sits on a folded card stand beside the sleeve (M4 spec FR-13).
import { defineSheet, shape } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Pen lifter: parts',
  parts: [
    shape({
      name: 'Pen sleeve (roll round the pen, glue the tab)',
      width: 60,
      height: 70,
      path: 'M0 0H60V70H0Z',
      folds: [{ x1: 48, y1: 0, x2: 48, y2: 70 }],
      measurements: [
        'sleeve: 48 × 70 mm rolled into a tube, plus a 12 mm glue tab',
        'roll it round the pen itself so the pen slides up and down easily'
      ]
    }),
    shape({
      name: 'Servo stand (fold into a square tube)',
      width: 110,
      height: 45,
      path: 'M0 0H110V45H0Z',
      folds: [
        { x1: 25, y1: 0, x2: 25, y2: 45 },
        { x1: 50, y1: 0, x2: 50, y2: 45 },
        { x1: 75, y1: 0, x2: 75, y2: 45 },
        { x1: 100, y1: 0, x2: 100, y2: 45 }
      ],
      measurements: [
        'four sides 25 × 45 mm and a 10 mm glue tab',
        'Prestik the servo on top, its arm just under the pen collar'
      ]
    }),
    shape({
      name: 'Pen collar (wrap round the pen)',
      width: 70,
      height: 15,
      path: 'M0 0H70V15H0Z',
      measurements: [
        'collar: 70 × 15 mm; wrap it tightly and tape it, about 15 mm above the sleeve'
      ]
    }),
    shape({
      name: 'Pen hole guide',
      width: 40,
      height: 40,
      path: 'M0 0H40V40H0Z',
      holes: [{ x: 20, y: 20, d: 14 }],
      measurements: [
        'draw round the 14 mm hole on the cart deck, halfway between the two wheels',
        'an adult cuts the hole in the deck'
      ]
    })
  ]
});
