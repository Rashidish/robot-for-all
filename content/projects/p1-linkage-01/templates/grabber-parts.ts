// Parts for "Extending grabber" (p1-linkage-01). Drawn by Claude; reviewed with the lesson.
// Six equal links (holes at both ends and the middle) make three X's; two claws go on the front.
import { defineSheet, shape, strip } from '../../../../packages/templates/src/index';

const link = (n: number) => strip({ name: `Link ${n}`, length: 120, width: 15, holes: 3 });

const claw = (n: number) =>
  shape({
    name: `Claw ${n}`,
    width: 60,
    height: 30,
    path: 'M4 10Q4 4 10 4H40Q56 4 58 16L58 28L50 22L44 26Q40 16 30 16H10Q4 16 4 10Z',
    holes: [{ x: 11, y: 10, d: 4 }],
    measurements: ['hook-shaped claw; hole at the straight end']
  });

export default defineSheet({
  title: 'Extending grabber: parts',
  parts: [link(1), link(2), link(3), link(4), link(5), link(6), claw(1), claw(2)]
});
