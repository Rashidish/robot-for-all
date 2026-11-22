// Parts for "Snapping crocodile" (p1-lever-01). Drawn by Claude; reviewed with the lesson.
// Works like a clothes peg: each jaw has a handle angled away at the pivot, so when the jaws are
// stacked and joined the handles spread apart. Squeezing the handles opens the mouth; a rubber
// band around the snout snaps it shut. Three pivot holes let learners move the pivot.
import { defineSheet, shape } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Snapping crocodile: jaws',
  parts: [
    shape({
      name: 'Top jaw (teeth along the bottom)',
      width: 180,
      height: 50,
      path:
        'M2 4L85 22H120Q170 22 178 34L178 38L171 48L165 38L159 48L153 38L147 48L141 38L135 48L129 38L123 48L117 38L111 42H85L2 18Z',
      holes: [
        { x: 70, y: 28, d: 4 },
        { x: 85, y: 32, d: 4 },
        { x: 100, y: 32, d: 4 }
      ],
      measurements: [
        'jaw: straight part on the right, 93 mm long and 20 mm deep, with teeth underneath',
        'handle: slopes up to the left, ending 14 mm wide',
        '3 pivot holes 15 mm apart, 70 mm, 85 mm and 100 mm from the left end'
      ]
    }),
    shape({
      name: 'Bottom jaw (teeth along the top)',
      width: 180,
      height: 50,
      path:
        'M2 46L85 28H120Q170 28 178 16L178 12L171 2L165 12L159 2L153 12L147 2L141 12L135 2L129 12L123 2L117 12L111 8H85L2 32Z',
      holes: [
        { x: 70, y: 22, d: 4 },
        { x: 85, y: 18, d: 4 },
        { x: 100, y: 18, d: 4 }
      ],
      measurements: ['the top jaw flipped upside down: handle slopes down to the left']
    })
  ]
});
