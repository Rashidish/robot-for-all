// Tunnel roof and gate flap for printed courses (M4 spec §14.4). Drawn by Claude; reviewed with
// the lesson. The tunnel is two standard wall pieces 150 mm apart with this roof on top: dark
// inside for the light sensor. The gate flap is hinged on its tab, so it flips over when a
// whisker touches it and judges can see the mission was done.
import { defineSheet, shape } from '../../../../packages/templates/src/index';

export default defineSheet({
  title: 'Tunnel roof and gate flap',
  parts: [
    shape({
      name: 'Tunnel roof, half (trace twice and tape the halves end to end)',
      width: 180,
      height: 100,
      path: 'M0 0H180V100H0Z',
      folds: [
        { x1: 15, y1: 0, x2: 15, y2: 100 },
        { x1: 165, y1: 0, x2: 165, y2: 100 }
      ],
      measurements: [
        'whole roof: 150 × 200 mm between the folds (two halves), with a 15 mm flap each side to tape to the walls',
        'colour the inside dark (koki or paint) so the tunnel stays dark'
      ]
    }),
    shape({
      name: 'Gate flap (wrap the hinge tab round a straw laid across two walls)',
      width: 120,
      height: 80,
      path: 'M0 0H120V80H0Z',
      folds: [{ x1: 0, y1: 60, x2: 120, y2: 60 }],
      measurements: [
        'flap: 120 × 60 mm, hangs down to the floor; the 20 mm hinge tab wraps round the straw'
      ]
    })
  ]
});
