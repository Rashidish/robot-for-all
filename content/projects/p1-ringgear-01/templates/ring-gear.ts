// Parts for "Ring gear: rolling inside" (p1-ringgear-01). Drawn by Claude; reviewed with the
// lesson. A 36-tooth ring gear, a 12-tooth gear that rolls inside it, and the arm that holds the
// small gear at exactly the meshing distance from the ring's centre (pitch 9 mm, as every card
// gear). The base disc is on its own sheet (ring-base).
import {
  defineSheet,
  gear,
  internalCentreDistance,
  ringGear,
  strip
} from '../../../../packages/templates/src/index';

const inset = 7.5; // strip holes sit half the strip width from each end

export default defineSheet({
  title: 'Ring gear: parts',
  parts: [
    ringGear({ name: 'Ring gear (36 teeth)', teeth: 36 }),
    gear({ name: 'Small gear (12 teeth)', teeth: 12, axleHole: 4 }),
    strip({
      name: 'Arm',
      length: Math.round((internalCentreDistance(36, 12) + 2 * inset) * 10) / 10,
      width: 15,
      holes: 2
    })
  ]
});
