// The base for "Ring gear: rolling inside" (p1-ringgear-01): a disc the same size as the ring
// gear, with a hole in its exact centre for the arm's pivot. Glue the ring on it, edges lined up.
import { defineSheet, disc, ringGear } from '../../../../packages/templates/src/index';

const ring = ringGear({ name: 'Ring gear (36 teeth)', teeth: 36 });

export default defineSheet({
  title: 'Ring gear: base',
  parts: [
    disc({
      name: 'Base (glue the ring gear on it, edges lined up)',
      diameter: Math.round(ring.width * 10) / 10,
      axleHole: 4
    })
  ]
});
