// Parts for "Bouncing animal box" (p1-cam-01). Drawn by Claude; reviewed with the lesson.
// Two cams to compare (egg cam; round disc used through its off-centre hole), a follower foot,
// an animal and a handle. Axle holes fit a wooden skewer (3 mm).
import { cam, defineSheet, disc, shape, strip } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Bouncing animal box: parts',
  parts: [
    cam({ name: 'Egg cam', base: 40, lift: 15, axleHole: 3 }),
    disc({ name: 'Round cam (use the off-centre hole)', diameter: 44, axleHole: 3, offsets: [8], pinHole: 3 }),
    disc({ name: 'Follower foot', diameter: 26, axleHole: 3 }),
    shape({
      name: 'Frog',
      width: 70,
      height: 45,
      path: 'M8 38C2 30 6 18 18 16C20 6 30 4 34 12C38 4 48 6 50 16C62 18 68 30 62 38C56 44 14 44 8 38Z',
      holes: [{ x: 35, y: 38, d: 3 }],
      measurements: ['frog shape about 70 mm wide; follower hole in the middle of its belly']
    }),
    strip({ name: 'Handle', length: 50, width: 12, holes: 1, holeDiameter: 3 })
  ]
});
