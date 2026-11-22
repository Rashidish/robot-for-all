// MakeCode-level blocks (M3 spec §15, step 4b), described as data. Each spec says which fields a
// block has; validation, Blockly definitions, Blockly ⇄ program conversion and MicroPython all
// come from the same description, so a new block is one entry here plus its English text.
// Program types start with "x_" so they never clash with the core blocks in program.ts.
import type { Category } from './colours';
import type { Expr, Stmt } from './program';
import { ICON_NAMES } from './icons';

export type GenericNode = { type: `x_${string}`; [key: string]: unknown };

type Option = readonly [label: string, value: string];

export type FieldSpec =
  | { kind: 'expr'; key: string; input: string; check?: string | string[]; shadow?: Expr }
  | { kind: 'stmts'; key: string; input: string }
  | { kind: 'enum'; key: string; field: string; options: readonly Option[] }
  | { kind: 'int'; key: string; field: string; min: number; max: number; value: number }
  | { kind: 'text'; key: string; field: string; value: string; maxLength: number }
  | { kind: 'ident'; key: string; field: string; value: string }
  | { kind: 'leds'; key: string };

/** What the generator gives each block when turning it into MicroPython. */
export interface PyContext {
  expr(e: Expr): string;
  bare(e: Expr): string;
  block(list: Stmt[], depth: number): string[];
  pad: string;
  /** Marks a module or helper as needed: random, music, radio, math, neopixel, number. */
  use(name: string): void;
  /** A unique Python name for a helper variable, e.g. "_every_0". */
  unique(base: string): string;
}

interface BaseSpec {
  type: `x_${string}`;
  category: Category;
  fields: readonly FieldSpec[];
  /** Needs a micro:bit V2 (sound, logo, microphone); shown in the block's tooltip. */
  v2?: boolean;
}

export interface ExprSpec extends BaseSpec {
  role: 'expr';
  output: 'Number' | 'Boolean' | 'String' | 'Colour' | 'Array' | 'Image' | 'Sprite';
  py: (n: GenericNode, c: PyContext) => string;
}
export interface StmtSpec extends BaseSpec {
  role: 'stmt';
  py: (n: GenericNode, c: PyContext) => string[];
}
export interface LoopParts {
  /** Lines before the main loop. */
  setup?: string[];
  /** Lines in the loop before the check. */
  before?: string[];
  cond: string;
  /** Lines in the loop after the check, whether or not it ran. */
  after?: string[];
  /** Lines at the start of the handler body when it runs. */
  afterTrue?: string[];
}

/** Event blocks checked once per pass of the main loop, like "on button pressed". */
export interface HandlerSpec extends BaseSpec {
  role: 'handler';
  /** Lines run before the loop (setup), and the condition checked in the loop. */
  loop: (n: GenericNode, c: PyContext) => LoopParts;
}
/** A function definition. */
export interface FunctionSpec extends BaseSpec {
  role: 'function';
}

export type NodeSpec = ExprSpec | StmtSpec | HandlerSpec | FunctionSpec;

const n = (value: number): Expr => ({ type: 'number', value });
const t = (value: string): Expr => ({ type: 'text', value });
const pins: readonly Option[] = [
  ['P0', '0'],
  ['P1', '1'],
  ['P2', '2']
];
const e = (key: string, input: string, check?: string | string[], shadow?: Expr): FieldSpec => ({
  kind: 'expr',
  key,
  input,
  ...(check ? { check } : {}),
  ...(shadow ? { shadow } : {})
});
const pinField: FieldSpec = { kind: 'enum', key: 'pin', field: 'PIN', options: pins };
const body: FieldSpec = { kind: 'stmts', key: 'body', input: 'DO' };
const num = (c: PyContext, node: GenericNode, key: string) => c.bare(node[key] as Expr);

const GESTURES: readonly Option[] = [
  ['%{BKY_GESTURE_SHAKE}', 'shake'],
  ['%{BKY_GESTURE_LOGO_UP}', 'up'],
  ['%{BKY_GESTURE_LOGO_DOWN}', 'down'],
  ['%{BKY_GESTURE_FACE_UP}', 'face up'],
  ['%{BKY_GESTURE_FACE_DOWN}', 'face down'],
  ['%{BKY_GESTURE_TILT_LEFT}', 'left'],
  ['%{BKY_GESTURE_TILT_RIGHT}', 'right'],
  ['%{BKY_GESTURE_FREE_FALL}', 'freefall']
];
const MELODIES = [
  'DADADADUM',
  'ENTERTAINER',
  'PRELUDE',
  'ODE',
  'NYAN',
  'RINGTONE',
  'FUNK',
  'BLUES',
  'BIRTHDAY',
  'WEDDING',
  'FUNERAL',
  'PUNCHLINE',
  'PYTHON',
  'BADDY',
  'CHASE',
  'BA_DING',
  'WAWAWAWAA',
  'JUMP_UP',
  'JUMP_DOWN',
  'POWER_UP',
  'POWER_DOWN'
].map((m) => [m.toLowerCase().replace(/_/g, ' '), m] as const);
const SOUNDS = [
  'GIGGLE',
  'HAPPY',
  'HELLO',
  'MYSTERIOUS',
  'SAD',
  'SLIDE',
  'SOARING',
  'SPRING',
  'TWINKLE',
  'YAWN'
].map((s) => [s.toLowerCase(), s] as const);
const NOTES: readonly Option[] = [
  ['C 262', '262'],
  ['D 294', '294'],
  ['E 330', '330'],
  ['F 349', '349'],
  ['G 392', '392'],
  ['A 440', '440'],
  ['B 494', '494'],
  ['C5 523', '523']
];
const ARROWS: readonly Option[] = [
  ['↑ N', 'N'],
  ['↗ NE', 'NE'],
  ['→ E', 'E'],
  ['↘ SE', 'SE'],
  ['↓ S', 'S'],
  ['↙ SW', 'SW'],
  ['← W', 'W'],
  ['↖ NW', 'NW']
];
const COLOURS: readonly Option[] = [
  ['%{BKY_COLOUR_RED}', '255,0,0'],
  ['%{BKY_COLOUR_ORANGE}', '255,128,0'],
  ['%{BKY_COLOUR_YELLOW}', '255,255,0'],
  ['%{BKY_COLOUR_GREEN}', '0,255,0'],
  ['%{BKY_COLOUR_BLUE}', '0,0,255'],
  ['%{BKY_COLOUR_PURPLE}', '128,0,255'],
  ['%{BKY_COLOUR_WHITE}', '255,255,255'],
  ['%{BKY_COLOUR_OFF}', '0,0,0']
];
const colourShadow: Expr = { type: 'x_colour', colour: '255,0,0' } as unknown as Expr;

export const EXTRA_SPECS: readonly NodeSpec[] = [
  // ---- Basic
  {
    type: 'x_show_leds',
    role: 'stmt',
    category: 'basic',
    fields: [{ kind: 'leds', key: 'leds' }],
    py: (node, c) => {
      const leds = String(node['leds']);
      const rows = [0, 1, 2, 3, 4].map((r) => leds.slice(r * 5, r * 5 + 5).replace(/1/g, '9'));
      return [`${c.pad}display.show(Image("${rows.join(':')}"))`];
    }
  },
  {
    type: 'x_show_arrow',
    role: 'stmt',
    category: 'basic',
    fields: [{ kind: 'enum', key: 'dir', field: 'DIR', options: ARROWS }],
    py: (node, c) => [`${c.pad}display.show(Image.ARROW_${String(node['dir'])})`]
  },
  // ---- Input
  {
    type: 'x_on_gesture',
    role: 'handler',
    category: 'input',
    fields: [{ kind: 'enum', key: 'gesture', field: 'GESTURE', options: GESTURES }, body],
    loop: (node) => ({ cond: `accelerometer.was_gesture("${String(node['gesture'])}")` })
  },
  {
    type: 'x_on_pin_pressed',
    role: 'handler',
    category: 'input',
    fields: [pinField, body],
    loop: (node, c) => {
      const was = c.unique('_touched');
      const now = c.unique('_touch');
      return {
        setup: [`${was} = False`],
        before: [`${now} = pin${String(node['pin'])}.is_touched()`],
        cond: `${now} and not ${was}`,
        after: [`${was} = ${now}`]
      };
    }
  },
  {
    type: 'x_on_logo_touched',
    role: 'handler',
    category: 'input',
    v2: true,
    fields: [body],
    loop: (_node, c) => {
      const was = c.unique('_logo_was');
      const now = c.unique('_logo');
      return {
        setup: [`${was} = False`],
        before: [`${now} = pin_logo.is_touched()`],
        cond: `${now} and not ${was}`,
        after: [`${was} = ${now}`]
      };
    }
  },
  {
    type: 'x_on_loud_sound',
    role: 'handler',
    category: 'input',
    v2: true,
    fields: [body],
    loop: () => ({ cond: 'microphone.was_event(SoundEvent.LOUD)' })
  },
  {
    type: 'x_compass_heading',
    role: 'expr',
    output: 'Number',
    category: 'input',
    fields: [],
    py: () => 'compass.heading()'
  },
  {
    type: 'x_sound_level',
    role: 'expr',
    output: 'Number',
    category: 'input',
    v2: true,
    fields: [],
    py: () => 'microphone.sound_level()'
  },
  {
    type: 'x_running_time',
    role: 'expr',
    output: 'Number',
    category: 'input',
    fields: [],
    py: () => 'running_time()'
  },
  {
    type: 'x_logo_is_pressed',
    role: 'expr',
    output: 'Boolean',
    category: 'input',
    v2: true,
    fields: [],
    py: () => 'pin_logo.is_touched()'
  },
  {
    type: 'x_pin_is_pressed',
    role: 'expr',
    output: 'Boolean',
    category: 'input',
    fields: [pinField],
    py: (node) => `pin${String(node['pin'])}.is_touched()`
  },
  // ---- Music
  {
    type: 'x_play_tone',
    role: 'stmt',
    category: 'music',
    fields: [
      e('freq', 'FREQ', 'Number', { type: 'x_note', note: '262' } as unknown as Expr),
      e('ms', 'MS', 'Number', n(500))
    ],
    py: (node, c) => {
      c.use('music');
      return [`${c.pad}music.pitch(int(${num(c, node, 'freq')}), int(${num(c, node, 'ms')}))`];
    }
  },
  {
    type: 'x_note',
    role: 'expr',
    output: 'Number',
    category: 'music',
    fields: [{ kind: 'enum', key: 'note', field: 'NOTE', options: NOTES }],
    py: (node) => String(node['note'])
  },
  {
    type: 'x_rest',
    role: 'stmt',
    category: 'music',
    fields: [e('ms', 'MS', 'Number', n(500))],
    py: (node, c) => [`${c.pad}sleep(${num(c, node, 'ms')})`]
  },
  {
    type: 'x_play_melody',
    role: 'stmt',
    category: 'music',
    fields: [{ kind: 'enum', key: 'melody', field: 'MELODY', options: MELODIES }],
    py: (node, c) => {
      c.use('music');
      return [`${c.pad}music.play(music.${String(node['melody'])})`];
    }
  },
  {
    type: 'x_start_melody',
    role: 'stmt',
    category: 'music',
    fields: [{ kind: 'enum', key: 'melody', field: 'MELODY', options: MELODIES }],
    py: (node, c) => {
      c.use('music');
      return [`${c.pad}music.play(music.${String(node['melody'])}, wait=False)`];
    }
  },
  {
    type: 'x_stop_music',
    role: 'stmt',
    category: 'music',
    fields: [],
    py: (_node, c) => {
      c.use('music');
      return [`${c.pad}music.stop()`];
    }
  },
  {
    type: 'x_set_tempo',
    role: 'stmt',
    category: 'music',
    fields: [e('bpm', 'BPM', 'Number', n(120))],
    py: (node, c) => {
      c.use('music');
      return [`${c.pad}music.set_tempo(bpm=int(${num(c, node, 'bpm')}))`];
    }
  },
  {
    type: 'x_play_sound',
    role: 'stmt',
    category: 'music',
    v2: true,
    fields: [{ kind: 'enum', key: 'sound', field: 'SOUND', options: SOUNDS }],
    py: (node, c) => [`${c.pad}audio.play(Sound.${String(node['sound'])})`]
  },
  {
    type: 'x_set_volume',
    role: 'stmt',
    category: 'music',
    v2: true,
    fields: [e('volume', 'VOLUME', 'Number', n(128))],
    py: (node, c) => [`${c.pad}set_volume(int(${num(c, node, 'volume')}))`]
  },
  // ---- LED
  {
    type: 'x_plot',
    role: 'stmt',
    category: 'led',
    fields: [e('x', 'X', 'Number', n(0)), e('y', 'Y', 'Number', n(0))],
    py: (node, c) => [
      `${c.pad}display.set_pixel(int(${num(c, node, 'x')}), int(${num(c, node, 'y')}), 9)`
    ]
  },
  {
    type: 'x_unplot',
    role: 'stmt',
    category: 'led',
    fields: [e('x', 'X', 'Number', n(0)), e('y', 'Y', 'Number', n(0))],
    py: (node, c) => [
      `${c.pad}display.set_pixel(int(${num(c, node, 'x')}), int(${num(c, node, 'y')}), 0)`
    ]
  },
  {
    type: 'x_toggle',
    role: 'stmt',
    category: 'led',
    fields: [e('x', 'X', 'Number', n(0)), e('y', 'Y', 'Number', n(0))],
    py: (node, c) => {
      const x = `int(${num(c, node, 'x')})`;
      const y = `int(${num(c, node, 'y')})`;
      return [`${c.pad}display.set_pixel(${x}, ${y}, 0 if display.get_pixel(${x}, ${y}) else 9)`];
    }
  },
  {
    type: 'x_plot_brightness',
    role: 'stmt',
    category: 'led',
    fields: [
      e('x', 'X', 'Number', n(0)),
      e('y', 'Y', 'Number', n(0)),
      e('b', 'B', 'Number', n(255))
    ],
    py: (node, c) => [
      `${c.pad}display.set_pixel(int(${num(c, node, 'x')}), int(${num(c, node, 'y')}), max(0, min(9, int(${num(c, node, 'b')}) * 9 // 255)))`
    ]
  },
  {
    type: 'x_point',
    role: 'expr',
    output: 'Boolean',
    category: 'led',
    fields: [e('x', 'X', 'Number', n(0)), e('y', 'Y', 'Number', n(0))],
    py: (node, c) => `(display.get_pixel(int(${num(c, node, 'x')}), int(${num(c, node, 'y')})) > 0)`
  },
  // ---- Radio
  {
    type: 'x_radio_group',
    role: 'stmt',
    category: 'radio',
    fields: [{ kind: 'int', key: 'group', field: 'GROUP', min: 0, max: 255, value: 1 }],
    py: (node, c) => {
      c.use('radio');
      return [`${c.pad}radio.config(group=${Number(node['group'])})`];
    }
  },
  {
    type: 'x_radio_send_number',
    role: 'stmt',
    category: 'radio',
    fields: [e('value', 'VALUE', 'Number', n(0))],
    py: (node, c) => {
      c.use('radio');
      c.use('number');
      return [`${c.pad}radio.send(_number(${num(c, node, 'value')}))`];
    }
  },
  {
    type: 'x_radio_send_string',
    role: 'stmt',
    category: 'radio',
    fields: [e('value', 'VALUE', ['String', 'Number'], t('hello'))],
    py: (node, c) => {
      c.use('radio');
      return [`${c.pad}radio.send(str(${num(c, node, 'value')}))`];
    }
  },
  {
    type: 'x_on_radio_number',
    role: 'handler',
    category: 'radio',
    fields: [body],
    loop: (_node, c) => {
      c.use('radio');
      return { cond: '_radio_number is not None' };
    }
  },
  {
    type: 'x_on_radio_string',
    role: 'handler',
    category: 'radio',
    fields: [body],
    loop: (_node, c) => {
      c.use('radio');
      return { cond: '_radio_text is not None' };
    }
  },
  {
    type: 'x_received_number',
    role: 'expr',
    output: 'Number',
    category: 'radio',
    fields: [],
    py: () => 'receivedNumber'
  },
  {
    type: 'x_received_string',
    role: 'expr',
    output: 'String',
    category: 'radio',
    fields: [],
    py: () => 'receivedString'
  },
  // ---- Loops
  {
    type: 'x_for_range',
    role: 'stmt',
    category: 'loops',
    fields: [
      { kind: 'ident', key: 'var', field: 'VAR', value: 'index' },
      e('to', 'TO', 'Number', n(4)),
      body
    ],
    py: (node, c) => [
      `${c.pad}for ${String(node['var'])} in range(int(${num(c, node, 'to')}) + 1):`,
      ...c.block(node['body'] as Stmt[], c.pad.length / 4 + 1)
    ]
  },
  {
    type: 'x_every',
    role: 'handler',
    category: 'loops',
    fields: [{ kind: 'int', key: 'ms', field: 'MS', min: 20, max: 3_600_000, value: 500 }, body],
    loop: (node, c) => {
      const last = c.unique('_every');
      return {
        setup: [`${last} = running_time()`],
        cond: `running_time() - ${last} >= ${Number(node['ms'])}`,
        afterTrue: [`${last} = running_time()`]
      };
    }
  },
  {
    type: 'x_break',
    role: 'stmt',
    category: 'loops',
    fields: [],
    py: (_node, c) => [`${c.pad}break`]
  },
  {
    type: 'x_continue',
    role: 'stmt',
    category: 'loops',
    fields: [],
    py: (_node, c) => [`${c.pad}continue`]
  },
  // ---- Math
  {
    type: 'x_remainder',
    role: 'expr',
    output: 'Number',
    category: 'math',
    fields: [e('a', 'A', 'Number', n(0)), e('b', 'B', 'Number', n(1))],
    py: (node, c) => `(${c.expr(node['a'] as Expr)} % ${c.expr(node['b'] as Expr)})`
  },
  {
    type: 'x_minmax',
    role: 'expr',
    output: 'Number',
    category: 'math',
    fields: [
      {
        kind: 'enum',
        key: 'op',
        field: 'OP',
        options: [
          ['%{BKY_MATH_MIN}', 'min'],
          ['%{BKY_MATH_MAX}', 'max']
        ]
      },
      e('a', 'A', 'Number', n(0)),
      e('b', 'B', 'Number', n(0))
    ],
    py: (node, c) =>
      `${String(node['op'])}(${c.bare(node['a'] as Expr)}, ${c.bare(node['b'] as Expr)})`
  },
  {
    type: 'x_math_op',
    role: 'expr',
    output: 'Number',
    category: 'math',
    fields: [
      {
        kind: 'enum',
        key: 'op',
        field: 'OP',
        options: [
          ['%{BKY_MATH_ABS}', 'abs'],
          ['%{BKY_MATH_SQRT}', 'sqrt'],
          ['%{BKY_MATH_ROUND}', 'round'],
          ['%{BKY_MATH_FLOOR}', 'floor']
        ]
      },
      e('a', 'A', 'Number', n(0))
    ],
    py: (node, c) => {
      const op = String(node['op']);
      const a = c.bare(node['a'] as Expr);
      if (op === 'abs' || op === 'round') return `${op}(${a})`;
      c.use('math');
      return `math.${op}(${a})`;
    }
  },
  {
    type: 'x_random_bool',
    role: 'expr',
    output: 'Boolean',
    category: 'math',
    fields: [],
    py: (_node, c) => {
      c.use('random');
      return '(random.randint(0, 1) == 1)';
    }
  },
  // ---- Text (Advanced)
  {
    type: 'x_join',
    role: 'expr',
    output: 'String',
    category: 'text',
    fields: [
      e('a', 'A', ['String', 'Number'], t('Hello')),
      e('b', 'B', ['String', 'Number'], t('World'))
    ],
    py: (node, c) => `(str(${c.bare(node['a'] as Expr)}) + str(${c.bare(node['b'] as Expr)}))`
  },
  {
    type: 'x_text_length',
    role: 'expr',
    output: 'Number',
    category: 'text',
    fields: [e('a', 'A', ['String', 'Number'], t('Hello'))],
    py: (node, c) => `len(str(${c.bare(node['a'] as Expr)}))`
  },
  {
    type: 'x_to_number',
    role: 'expr',
    output: 'Number',
    category: 'text',
    fields: [e('a', 'A', ['String', 'Number'], t('123'))],
    py: (node, c) => `float(${c.bare(node['a'] as Expr)})`
  },
  {
    type: 'x_text',
    role: 'expr',
    output: 'String',
    category: 'text',
    fields: [{ kind: 'text', key: 'value', field: 'TEXT', value: '', maxLength: 200 }],
    py: (node, c) => c.expr({ type: 'text', value: String(node['value']) })
  },
  // ---- Functions (Advanced)
  {
    type: 'x_function',
    role: 'function',
    category: 'functions',
    fields: [{ kind: 'ident', key: 'name', field: 'NAME', value: 'doSomething' }, body]
  },
  {
    type: 'x_call',
    role: 'stmt',
    category: 'functions',
    fields: [{ kind: 'ident', key: 'name', field: 'NAME', value: 'doSomething' }],
    py: (node, c) => [`${c.pad}${String(node['name'])}()`]
  },
  // ---- Pins (Advanced)
  {
    type: 'x_digital_read',
    role: 'expr',
    output: 'Number',
    category: 'pins',
    fields: [pinField],
    py: (node) => `pin${String(node['pin'])}.read_digital()`
  },
  {
    type: 'x_analog_read',
    role: 'expr',
    output: 'Number',
    category: 'pins',
    fields: [pinField],
    py: (node) => `pin${String(node['pin'])}.read_analog()`
  },
  {
    type: 'x_analog_write',
    role: 'stmt',
    category: 'pins',
    fields: [pinField, e('value', 'VALUE', 'Number', n(1023))],
    py: (node, c) => [
      `${c.pad}pin${String(node['pin'])}.write_analog(int(${num(c, node, 'value')}))`
    ]
  },
  {
    type: 'x_servo_write',
    role: 'stmt',
    category: 'pins',
    fields: [pinField, e('angle', 'ANGLE', 'Number', n(90))],
    py: (node, c) => {
      const pin = `pin${String(node['pin'])}`;
      return [
        `${c.pad}${pin}.set_analog_period(20)`,
        `${c.pad}${pin}.write_analog(int(26 + max(0, min(180, ${num(c, node, 'angle')})) * 102 / 180))`
      ];
    }
  },
  // ---- Serial (Advanced)
  {
    type: 'x_serial_line',
    role: 'stmt',
    category: 'serial',
    fields: [e('value', 'VALUE', ['String', 'Number', 'Boolean'], t('Hello'))],
    py: (node, c) => [`${c.pad}print(${c.bare(node['value'] as Expr)})`]
  },
  {
    type: 'x_serial_value',
    role: 'stmt',
    category: 'serial',
    fields: [
      { kind: 'text', key: 'label', field: 'LABEL', value: 'x', maxLength: 30 },
      e('value', 'VALUE', 'Number', n(0))
    ],
    py: (node, c) => {
      c.use('number');
      const label = c.expr({ type: 'text', value: `${String(node['label'])}:` });
      return [`${c.pad}print(${label} + _number(${num(c, node, 'value')}))`];
    }
  },
  // ---- Control (Advanced)
  {
    type: 'x_reset',
    role: 'stmt',
    category: 'control',
    fields: [],
    py: (_node, c) => [`${c.pad}reset()`]
  },
  // ---- Arrays (Advanced)
  {
    type: 'x_list_of',
    role: 'expr',
    output: 'Array',
    category: 'arrays',
    fields: [e('a', 'A', undefined, n(1)), e('b', 'B', undefined, n(2)), e('c', 'C', undefined, n(3))],
    py: (node, c) => `[${['a', 'b', 'c'].map((k) => c.bare(node[k] as Expr)).join(', ')}]`
  },
  { type: 'x_list_empty', role: 'expr', output: 'Array', category: 'arrays', fields: [], py: () => '[]' },
  {
    type: 'x_list_length',
    role: 'expr',
    output: 'Number',
    category: 'arrays',
    fields: [e('list', 'LIST', 'Array')],
    py: (node, c) => `len(${c.bare(node['list'] as Expr)})`
  },
  {
    type: 'x_list_get',
    role: 'expr',
    output: 'Number',
    category: 'arrays',
    fields: [e('list', 'LIST', 'Array'), e('index', 'INDEX', 'Number', n(0))],
    py: (node, c) => `${c.expr(node['list'] as Expr)}[int(${num(c, node, 'index')})]`
  },
  {
    type: 'x_list_set',
    role: 'stmt',
    category: 'arrays',
    fields: [e('list', 'LIST', 'Array'), e('index', 'INDEX', 'Number', n(0)), e('value', 'VALUE', undefined, n(0))],
    py: (node, c) => [`${c.pad}${c.expr(node['list'] as Expr)}[int(${num(c, node, 'index')})] = ${num(c, node, 'value')}`]
  },
  {
    type: 'x_list_add',
    role: 'stmt',
    category: 'arrays',
    fields: [e('list', 'LIST', 'Array'), e('value', 'VALUE', undefined, n(0))],
    py: (node, c) => [`${c.pad}${c.expr(node['list'] as Expr)}.append(${num(c, node, 'value')})`]
  },
  {
    type: 'x_list_remove',
    role: 'stmt',
    category: 'arrays',
    fields: [e('list', 'LIST', 'Array'), e('index', 'INDEX', 'Number', n(0))],
    py: (node, c) => [`${c.pad}${c.expr(node['list'] as Expr)}.pop(int(${num(c, node, 'index')}))`]
  },
  // ---- Images (Advanced)
  {
    type: 'x_image',
    role: 'expr',
    output: 'Image',
    category: 'images',
    fields: [{ kind: 'leds', key: 'leds' }],
    py: (node) => {
      const leds = String(node['leds']);
      const rows = [0, 1, 2, 3, 4].map((r) => leds.slice(r * 5, r * 5 + 5).replace(/1/g, '9'));
      return `Image("${rows.join(':')}")`;
    }
  },
  {
    type: 'x_icon_image',
    role: 'expr',
    output: 'Image',
    category: 'images',
    fields: [
      {
        kind: 'enum',
        key: 'icon',
        field: 'ICON',
        options: ICON_NAMES.map((name) => [name.toLowerCase().replace(/_/g, ' '), name] as const)
      }
    ],
    py: (node) => `Image.${String(node['icon'])}`
  },
  {
    type: 'x_show_image',
    role: 'stmt',
    category: 'images',
    fields: [e('image', 'IMAGE', 'Image', { type: 'x_icon_image', icon: 'HEART' } as unknown as Expr)],
    py: (node, c) => [`${c.pad}display.show(${c.bare(node['image'] as Expr)})`]
  },
  {
    type: 'x_animate',
    role: 'stmt',
    category: 'images',
    fields: [
      e('a', 'A', 'Image', { type: 'x_icon_image', icon: 'HEART' } as unknown as Expr),
      e('b', 'B', 'Image', { type: 'x_icon_image', icon: 'HEART_SMALL' } as unknown as Expr),
      e('ms', 'MS', 'Number', n(400))
    ],
    py: (node, c) => [
      `${c.pad}display.show([${c.bare(node['a'] as Expr)}, ${c.bare(node['b'] as Expr)}], delay=int(${num(c, node, 'ms')}))`
    ]
  },
  // ---- Game (Advanced)
  {
    type: 'x_sprite_create',
    role: 'expr',
    output: 'Sprite',
    category: 'game',
    fields: [e('x', 'X', 'Number', n(2)), e('y', 'Y', 'Number', n(2))],
    py: (node, c) => {
      c.use('game');
      return `game.Sprite(${num(c, node, 'x')}, ${num(c, node, 'y')})`;
    }
  },
  {
    type: 'x_sprite_move',
    role: 'stmt',
    category: 'game',
    fields: [e('sprite', 'SPRITE', 'Sprite'), e('steps', 'STEPS', 'Number', n(1))],
    py: (node, c) => {
      c.use('game');
      return [`${c.pad}${c.expr(node['sprite'] as Expr)}.move(${num(c, node, 'steps')})`];
    }
  },
  {
    type: 'x_sprite_turn',
    role: 'stmt',
    category: 'game',
    fields: [
      e('sprite', 'SPRITE', 'Sprite'),
      { kind: 'enum', key: 'way', field: 'WAY', options: [['%{BKY_GAME_RIGHT}', '45'], ['%{BKY_GAME_LEFT}', '-45']] }
    ],
    py: (node, c) => {
      c.use('game');
      return [`${c.pad}${c.expr(node['sprite'] as Expr)}.turn(${String(node['way'])})`];
    }
  },
  {
    type: 'x_sprite_change',
    role: 'stmt',
    category: 'game',
    fields: [
      e('sprite', 'SPRITE', 'Sprite'),
      { kind: 'enum', key: 'axis', field: 'AXIS', options: [['x', 'x'], ['y', 'y']] },
      e('by', 'BY', 'Number', n(1))
    ],
    py: (node, c) => {
      c.use('game');
      return [`${c.pad}${c.expr(node['sprite'] as Expr)}.change("${String(node['axis'])}", ${num(c, node, 'by')})`];
    }
  },
  {
    type: 'x_sprite_bounce',
    role: 'stmt',
    category: 'game',
    fields: [e('sprite', 'SPRITE', 'Sprite')],
    py: (node, c) => {
      c.use('game');
      const s = c.expr(node['sprite'] as Expr);
      return [`${c.pad}if ${s}.on_edge():`, `${c.pad}    ${s}.bounce()`];
    }
  },
  {
    type: 'x_sprite_touching',
    role: 'expr',
    output: 'Boolean',
    category: 'game',
    fields: [e('sprite', 'SPRITE', 'Sprite'), e('other', 'OTHER', 'Sprite')],
    py: (node, c) => {
      c.use('game');
      return `${c.expr(node['sprite'] as Expr)}.touching(${c.bare(node['other'] as Expr)})`;
    }
  },
  {
    type: 'x_sprite_position',
    role: 'expr',
    output: 'Number',
    category: 'game',
    fields: [e('sprite', 'SPRITE', 'Sprite'), { kind: 'enum', key: 'axis', field: 'AXIS', options: [['x', 'x'], ['y', 'y']] }],
    py: (node, c) => {
      c.use('game');
      return `${c.expr(node['sprite'] as Expr)}.${String(node['axis'])}`;
    }
  },
  {
    type: 'x_sprite_delete',
    role: 'stmt',
    category: 'game',
    fields: [e('sprite', 'SPRITE', 'Sprite')],
    py: (node, c) => {
      c.use('game');
      return [`${c.pad}${c.expr(node['sprite'] as Expr)}.delete()`];
    }
  },
  {
    type: 'x_score_change',
    role: 'stmt',
    category: 'game',
    fields: [e('by', 'BY', 'Number', n(1))],
    py: (node, c) => {
      c.use('game');
      return [`${c.pad}game.add_score(${num(c, node, 'by')})`];
    }
  },
  {
    type: 'x_score',
    role: 'expr',
    output: 'Number',
    category: 'game',
    fields: [],
    py: (_node, c) => {
      c.use('game');
      return 'game.score';
    }
  },
  {
    type: 'x_game_over',
    role: 'stmt',
    category: 'game',
    fields: [],
    py: (_node, c) => {
      c.use('game');
      return [`${c.pad}game.game_over()`];
    }
  },
  // ---- Extension: NeoPixel (RGB LEDs)
  {
    type: 'x_strip_init',
    role: 'stmt',
    category: 'neopixel',
    fields: [pinField, { kind: 'int', key: 'count', field: 'COUNT', min: 1, max: 64, value: 8 }],
    py: (node, c) => {
      c.use('neopixel');
      return [
        `${c.pad}strip = neopixel.NeoPixel(pin${String(node['pin'])}, ${Number(node['count'])})`
      ];
    }
  },
  {
    type: 'x_strip_fill',
    role: 'stmt',
    category: 'neopixel',
    fields: [e('colour', 'COLOUR', 'Colour', colourShadow)],
    py: (node, c) => {
      c.use('neopixel');
      return [
        `${c.pad}for _i in range(len(strip)):`,
        `${c.pad}    strip[_i] = ${c.bare(node['colour'] as Expr)}`,
        `${c.pad}strip.show()`
      ];
    }
  },
  {
    type: 'x_strip_set',
    role: 'stmt',
    category: 'neopixel',
    fields: [e('index', 'INDEX', 'Number', n(0)), e('colour', 'COLOUR', 'Colour', colourShadow)],
    py: (node, c) => {
      c.use('neopixel');
      return [`${c.pad}strip[int(${num(c, node, 'index')})] = ${c.bare(node['colour'] as Expr)}`];
    }
  },
  {
    type: 'x_strip_show',
    role: 'stmt',
    category: 'neopixel',
    fields: [],
    py: (_node, c) => {
      c.use('neopixel');
      return [`${c.pad}strip.show()`];
    }
  },
  {
    type: 'x_strip_clear',
    role: 'stmt',
    category: 'neopixel',
    fields: [],
    py: (_node, c) => {
      c.use('neopixel');
      return [`${c.pad}strip.clear()`];
    }
  },
  {
    type: 'x_colour',
    role: 'expr',
    output: 'Colour',
    category: 'neopixel',
    fields: [{ kind: 'enum', key: 'colour', field: 'COLOUR', options: COLOURS }],
    py: (node) => `(${String(node['colour'])})`
  },
  {
    type: 'x_rgb',
    role: 'expr',
    output: 'Colour',
    category: 'neopixel',
    fields: [
      e('r', 'R', 'Number', n(255)),
      e('g', 'G', 'Number', n(0)),
      e('b', 'B', 'Number', n(0))
    ],
    py: (node, c) => {
      const v = (k: string) => `max(0, min(255, int(${num(c, node, k)})))`;
      return `(${v('r')}, ${v('g')}, ${v('b')})`;
    }
  }
];

export const EXTRA_BY_TYPE = new Map(EXTRA_SPECS.map((s) => [s.type, s]));

export const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,29}$/;
