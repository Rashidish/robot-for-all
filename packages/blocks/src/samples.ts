// Sample programs used by tests and as starters for the Phase 2 lessons (M3 spec §7).
import type { Program } from './program';

export const SAMPLES = {
  blinkHeart: {
    version: 1,
    handlers: [
      {
        type: 'forever',
        body: [
          { type: 'show_icon', icon: 'HEART' },
          { type: 'pause', ms: { type: 'number', value: 500 } },
          { type: 'clear' },
          { type: 'pause', ms: { type: 'number', value: 500 } }
        ]
      }
    ]
  },
  buttonFaces: {
    version: 1,
    handlers: [
      { type: 'on_start', body: [{ type: 'show_icon', icon: 'ASLEEP' }] },
      { type: 'on_button', button: 'A', body: [{ type: 'show_icon', icon: 'HAPPY' }] },
      { type: 'on_button', button: 'B', body: [{ type: 'show_icon', icon: 'SAD' }] }
    ]
  },
  nightLight: {
    version: 1,
    handlers: [
      {
        type: 'forever',
        body: [
          {
            type: 'if',
            cond: {
              type: 'compare',
              op: 'lt',
              a: { type: 'light_level' },
              b: { type: 'number', value: 50 }
            },
            then: [{ type: 'show_icon', icon: 'SQUARE' }],
            else: [{ type: 'clear' }]
          },
          { type: 'pause', ms: { type: 'number', value: 100 } }
        ]
      }
    ]
  },
  goAndStop: {
    version: 1,
    handlers: [
      {
        type: 'on_button',
        button: 'A',
        body: [
          { type: 'motor', action: 'forward' },
          { type: 'show_icon', icon: 'ARROW_N' },
          { type: 'pause', ms: { type: 'number', value: 1000 } },
          { type: 'motor', action: 'stop' },
          { type: 'clear' }
        ]
      },
      {
        type: 'on_button',
        button: 'B',
        body: [
          { type: 'motor', action: 'reverse' },
          { type: 'show_icon', icon: 'ARROW_S' },
          { type: 'pause', ms: { type: 'number', value: 1000 } },
          { type: 'motor', action: 'stop' },
          { type: 'clear' }
        ]
      }
    ]
  },
  countdown: {
    version: 1,
    handlers: [
      {
        type: 'on_start',
        body: [
          { type: 'set', name: 'count', value: { type: 'number', value: 3 } },
          {
            type: 'repeat',
            times: { type: 'number', value: 3 },
            body: [
              { type: 'show_number', value: { type: 'var', name: 'count' } },
              { type: 'change', name: 'count', by: { type: 'number', value: -1 } },
              { type: 'pause', ms: { type: 'number', value: 200 } }
            ]
          },
          { type: 'show_text', value: { type: 'text', value: 'Go "robot"!' } },
          {
            type: 'while',
            cond: { type: 'compare', op: 'lt', a: { type: 'var', name: 'count' }, b: { type: 'number', value: 4 } },
            body: [
              { type: 'change', name: 'count', by: { type: 'number', value: 2 } },
              { type: 'digital_write', pin: 2, value: 1 }
            ]
          },
          { type: 'show_number', value: { type: 'arith', op: '*', a: { type: 'var', name: 'count' }, b: { type: 'number', value: 1.5 } } }
        ]
      }
    ]
  }
} satisfies Record<string, Program>;
