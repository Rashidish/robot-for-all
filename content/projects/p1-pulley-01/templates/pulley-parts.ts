// Parts for "Rubber-band pulley lift" (p1-pulley-01). Drawn by Claude; reviewed with the lesson.
// Each pulley is a core disc glued between two bigger flange discs so the rubber band stays in the groove.
// Big core 56 mm, small core 28 mm: the small pulley turns twice for each turn of the big one.
import { defineSheet, disc, strip } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Rubber-band pulley lift: parts',
  parts: [
    disc({ name: 'Big flange 1', diameter: 70, axleHole: 3 }),
    disc({ name: 'Big flange 2', diameter: 70, axleHole: 3 }),
    disc({ name: 'Big core', diameter: 56, axleHole: 3 }),
    disc({ name: 'Small flange 1', diameter: 40, axleHole: 3 }),
    disc({ name: 'Small flange 2', diameter: 40, axleHole: 3 }),
    disc({ name: 'Small core', diameter: 28, axleHole: 3 }),
    strip({ name: 'Handle 1', length: 50, width: 12, holes: 2, holeDiameter: 3 }),
    strip({ name: 'Handle 2', length: 50, width: 12, holes: 2, holeDiameter: 3 })
  ]
});
