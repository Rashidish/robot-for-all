// Parts for "Spinning gear train" (p1-gear-01). Drawn by Claude; reviewed with the lesson.
// Three gears with the same tooth spacing (pitch 9 mm) so they mesh: 12, 24 and 12 teeth.
// The board guide puts the three axles in a row, each pair exactly the meshing distance apart.
import {
  defineSheet,
  gear,
  gearCentreDistance,
  strip
} from '../../../../packages/templates/src/index';

const distance = gearCentreDistance(12, 24); // the same for 24 + 12, so one evenly spaced strip works
const inset = 7.5; // strip holes sit half the strip width from each end

export default defineSheet({
  title: 'Spinning gear train: parts',
  parts: [
    gear({ name: 'Gear B (24 teeth)', teeth: 24, axleHole: 4 }),
    gear({ name: 'Gear A (12 teeth)', teeth: 12, axleHole: 4 }),
    gear({ name: 'Gear C (12 teeth)', teeth: 12, axleHole: 4 }),
    strip({
      name: 'Board guide (axle holes)',
      length: Math.round((2 * distance + 2 * inset) * 10) / 10,
      width: 15,
      holes: 3
    })
  ]
});
