// Parts for "Crank-powered waving rhino" (p1-crank-01). Drawn by Claude; reviewed with the lesson.
// Sizes are millimetres at true scale on A4.
import { defineSheet, disc, shape, strip } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Waving rhino: parts',
  parts: [
    shape({
      name: 'Rhino body',
      width: 120,
      height: 70,
      path: 'M8 38C8 20 26 12 50 12H92C108 12 116 24 116 38V52H106V68H94V52H36V68H24V52H14C10 52 8 46 8 38Z',
      holes: [
        { x: 100, y: 26, d: 4 },
        { x: 60, y: 40, d: 4 }
      ],
      measurements: ['head pivot hole near the front top; crank axle hole in the middle']
    }),
    shape({
      name: 'Head',
      width: 56,
      height: 40,
      path: 'M5 25C5 12 18 6 30 8L40 2L44 4L40 12C48 14 52 20 52 26C52 34 44 38 34 38H14C8 38 5 32 5 25Z',
      holes: [
        { x: 12, y: 22, d: 4 },
        { x: 32, y: 30, d: 4 }
      ],
      measurements: ['pivot hole at the back of the head; push-rod hole under the horn']
    }),
    disc({ name: 'Crank disc', diameter: 50, offsets: [8, 14] }),
    strip({ name: 'Push rod', length: 90, width: 12, holes: 2 }),
    strip({ name: 'Handle', length: 40, width: 12, holes: 1 })
  ]
});
