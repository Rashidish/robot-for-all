// Parts for "Waving robot (four-bar linkage)" (p1-linkage-02). Drawn by Claude; reviewed with the lesson.
// Fixed link 80 mm (body holes), crank 30, coupler 90, rocker 60 (arm holes 1-2):
// 30 + 90 < 80 + 60, so the crank turns all the way round and the arm swings about 70 degrees.
import { defineSheet, shape, strip } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Waving robot: parts',
  parts: [
    shape({
      name: 'Body',
      width: 110,
      height: 140,
      path: 'M10 0H100Q110 0 110 10V130Q110 140 100 140H10Q0 140 0 130V10Q0 0 10 0Z',
      // Shoulder hole near the top right; crank hole lower left: 80 mm apart (48 across, 64 down).
      holes: [
        { x: 85, y: 20, d: 4 },
        { x: 37, y: 84, d: 4 }
      ],
      measurements: [
        'body: 110 × 140 mm',
        'shoulder hole 25 mm from the right and 20 mm from the top; crank hole 37 mm from the left and 84 mm from the top (80 mm apart)'
      ]
    }),
    strip({ name: 'Crank', length: 45, width: 15, holes: 2 }),
    strip({ name: 'Coupler', length: 105, width: 15, holes: 2 }),
    strip({ name: 'Arm (rocker)', length: 135, width: 15, holes: 3 }),
    shape({
      name: 'Hand',
      width: 40,
      height: 40,
      path: 'M14 40V22L4 12Q2 6 8 8L14 14V4Q16 0 19 4V14L22 2Q25 -1 27 3L26 15L32 6Q36 4 36 9L28 24Q26 40 20 40Z',
      measurements: ['hand about 40 mm tall; glue it to the end of the arm']
    })
  ]
});
