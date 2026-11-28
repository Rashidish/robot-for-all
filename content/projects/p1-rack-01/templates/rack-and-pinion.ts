// Parts for "Rack and pinion slider" (p1-rack-01). Drawn by Claude; reviewed with the lesson.
// Everything lies flat on the base: the fence strip is glued along the base's bottom edge, the
// rack slides along against it, and the pinion turns on an upright skewer through the base's
// hole, meshing with the rack. The hole is placed so the pinion's pitch circle just touches the
// rack's pitch line (pitch 9 mm, as every card gear).
import {
  defineSheet,
  gear,
  gearCentreDistance,
  rack,
  rackPitchLine,
  shape,
  strip
} from '../../../../packages/templates/src/index';

const base = { width: 170, height: 70 };
const fence = 12;
const theRack = rack({ name: 'Rack (16 teeth)', teeth: 16 });
const pinionRadius = gearCentreDistance(12, 12) / 2; // pitch radius of a 12-tooth gear
const holeY =
  Math.round((base.height - fence - theRack.height + rackPitchLine() - pinionRadius) * 10) / 10;

export default defineSheet({
  title: 'Rack and pinion: parts',
  parts: [
    shape({
      name: 'Base',
      width: base.width,
      height: base.height,
      path: `M0 0H${base.width}V${base.height}H0Z`,
      holes: [{ x: base.width / 2, y: holeY, d: 4 }],
      measurements: [
        `Base: the axle hole is in the middle, ${Math.round((base.height - holeY) * 10) / 10} mm above the bottom edge`
      ]
    }),
    gear({ name: 'Pinion (12 teeth)', teeth: 12, axleHole: 4 }),
    theRack,
    strip({ name: 'Fence (glue along the bottom edge of the base)', length: 170, width: fence })
  ]
});
