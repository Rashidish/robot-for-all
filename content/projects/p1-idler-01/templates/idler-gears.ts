// Parts for "Idler gears: same way round" (p1-idler-01). Drawn by Claude; reviewed with the lesson.
// Driver and follower have 12 teeth; two idlers (12 and 24 teeth) show that an idler's size
// changes the spacing but not the follower's speed. Each board guide puts three axles in a row,
// each pair exactly the meshing distance apart (pitch 9 mm, as every card gear).
import {
  defineSheet,
  gear,
  gearCentreDistance,
  strip
} from '../../../../packages/templates/src/index';

const inset = 7.5; // strip holes sit half the strip width from each end
const guide = (name: string, idlerTeeth: number) =>
  strip({
    name,
    length: Math.round((2 * gearCentreDistance(12, idlerTeeth) + 2 * inset) * 10) / 10,
    width: 15,
    holes: 3
  });

export default defineSheet({
  title: 'Idler gears: parts',
  parts: [
    gear({ name: 'Big idler (24 teeth)', teeth: 24, axleHole: 4 }),
    gear({ name: 'Driver (12 teeth)', teeth: 12, axleHole: 4 }),
    gear({ name: 'Follower (12 teeth)', teeth: 12, axleHole: 4 }),
    gear({ name: 'Small idler (12 teeth)', teeth: 12, axleHole: 4 }),
    guide('Board guide for the small idler', 12),
    guide('Board guide for the big idler', 24)
  ]
});
