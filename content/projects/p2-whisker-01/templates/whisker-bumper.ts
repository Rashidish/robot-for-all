// Parts for "Whisker bumper" (p2-whisker-01). Drawn by Claude; reviewed with the lesson.
// The front plate stands up on the front of the cart (glue the tab to the cart's deck). Each
// paper-clip whisker goes through a hole near the outside edge and bends forward; a strip of
// kitchen foil is glued just behind it on the plate. A bump pushes the whisker onto the foil,
// which closes the switch (M4 spec §14.3).
import { defineSheet, shape } from '../../../../packages/templates/src/index';

const foil = (side: string) =>
  shape({
    name: `Foil guide, ${side} (cut from kitchen foil)`,
    width: 30,
    height: 20,
    path: 'M0 0H30V20H0Z',
    measurements: ['foil patch: 30 × 20 mm; glue it on the plate where the dashed box is']
  });

export default defineSheet({
  title: 'Whisker bumper: parts',
  parts: [
    shape({
      name: 'Bumper front plate (fold the tab back and glue it to the cart)',
      width: 130,
      height: 70,
      // Plate 130 × 50 mm, then a 20 mm tab below the fold.
      path: 'M0 0H130V70H0Z',
      holes: [
        { x: 12, y: 12, d: 2 },
        { x: 118, y: 12, d: 2 }
      ],
      folds: [{ x1: 0, y1: 50, x2: 130, y2: 50 }],
      measurements: [
        'plate: 130 × 50 mm, plus a 20 mm glue tab below the fold',
        'whisker holes: 2 mm, 12 mm in from each top corner',
        'foil patches: 30 × 20 mm, 20 mm in from each side, 8 mm from the top'
      ]
    }),
    foil('left'),
    foil('right')
  ]
});
