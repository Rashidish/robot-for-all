// Parts for "One-motor scribble robot" (p1-motor-01). Drawn by Claude; reviewed with the lesson.
// Three weight discs glued together; the 2 mm off-centre hole fits a type-130 motor shaft.
// The band wraps around the cup to decorate it and give the tape something to grip.
import { defineSheet, disc, shape } from '../../../../packages/templates/src/index';

const weight = (n: number) =>
  disc({ name: `Weight disc ${n}`, diameter: 34, axleHole: 2, offsets: [11], pinHole: 2 });

export default defineSheet({
  title: 'One-motor scribble robot: parts',
  parts: [
    weight(1),
    weight(2),
    weight(3),
    shape({
      name: 'Cup band (decorate, then wrap around the cup)',
      width: 180,
      height: 40,
      path: 'M0 0H180V40H0Z',
      folds: [{ x1: 170, y1: 0, x2: 170, y2: 40 }],
      measurements: ['band: 180 × 40 mm; the last 10 mm is the overlap for glue']
    })
  ]
});
