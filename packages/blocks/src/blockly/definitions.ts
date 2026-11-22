// Block shapes for the editor (M3 spec FR-1), in Blockly's JSON format. Wording and categories
// follow MakeCode for micro:bit; text comes from content/i18n via %{BKY_...} message keys
// (Blockly.Msg["BLOCK_SHOW_NUMBER"] = m.block_show_number(), set by the editor).
// No Blockly import here, so these can be checked in plain unit tests.
import { CATEGORY_COLOURS as C } from '../colours';
import { ICON_NAMES, ICONS, type IconName } from '../icons';
import { EXTRA_SPECS, type FieldSpec, type NodeSpec } from '../extra';

/** A tiny picture of a micro:bit icon for the "show icon" menu (SVG data URL, our CSP allows data: images). */
export function iconImage(name: IconName): string {
  const rows = ICONS[name];
  let rects = '';
  rows.forEach((row, y) =>
    [...row].forEach((bit, x) => {
      rects += `<rect x="${x * 4 + 0.5}" y="${y * 4 + 0.5}" width="3" height="3" rx="0.6" fill="${bit === '1' ? '#e00' : '#ddd'}"/>`;
    })
  );
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${rects}</svg>`)}`;
}

const iconOptions = ICON_NAMES.map((name) => [
  { src: iconImage(name), width: 24, height: 24, alt: name.toLowerCase().replace(/_/g, ' ') },
  name
]);

const statement = { previousStatement: null, nextStatement: null } as const;
const value = (name: string, check?: string | string[]) => ({
  type: 'input_value',
  name,
  ...(check ? { check } : {})
});
const doInput = (name = 'DO') => ({ type: 'input_statement', name });
const buttons = [
  ['A', 'A'],
  ['B', 'B']
];

export const CORE_DEFINITIONS = [
  // Basic
  {
    type: 'rfa_on_start',
    message0: '%{BKY_BLOCK_ON_START}',
    message1: '%1',
    args1: [doInput()],
    colour: C.basic,
    tooltip: '%{BKY_BLOCK_ON_START_TIP}'
  },
  {
    type: 'rfa_forever',
    message0: '%{BKY_BLOCK_FOREVER}',
    message1: '%1',
    args1: [doInput()],
    colour: C.basic,
    tooltip: '%{BKY_BLOCK_FOREVER_TIP}'
  },
  {
    type: 'rfa_show_number',
    message0: '%{BKY_BLOCK_SHOW_NUMBER}',
    args0: [value('NUM', 'Number')],
    ...statement,
    colour: C.basic
  },
  {
    type: 'rfa_show_icon',
    message0: '%{BKY_BLOCK_SHOW_ICON}',
    args0: [{ type: 'field_dropdown', name: 'ICON', options: iconOptions }],
    ...statement,
    colour: C.basic
  },
  {
    type: 'rfa_show_string',
    message0: '%{BKY_BLOCK_SHOW_STRING}',
    args0: [value('TEXT', ['String', 'Number'])],
    ...statement,
    colour: C.basic
  },
  { type: 'rfa_clear', message0: '%{BKY_BLOCK_CLEAR}', ...statement, colour: C.basic },
  {
    type: 'rfa_pause',
    message0: '%{BKY_BLOCK_PAUSE}',
    args0: [value('MS', 'Number')],
    ...statement,
    colour: C.basic
  },
  // Input
  {
    type: 'rfa_on_button',
    message0: '%{BKY_BLOCK_ON_BUTTON}',
    args0: [{ type: 'field_dropdown', name: 'BUTTON', options: buttons }],
    message1: '%1',
    args1: [doInput()],
    colour: C.input
  },
  {
    type: 'rfa_button_is_pressed',
    message0: '%{BKY_BLOCK_BUTTON_IS_PRESSED}',
    args0: [{ type: 'field_dropdown', name: 'BUTTON', options: buttons }],
    output: 'Boolean',
    colour: C.input
  },
  {
    type: 'rfa_light_level',
    message0: '%{BKY_BLOCK_LIGHT_LEVEL}',
    output: 'Number',
    colour: C.input
  },
  {
    type: 'rfa_acceleration',
    message0: '%{BKY_BLOCK_ACCELERATION}',
    args0: [
      {
        type: 'field_dropdown',
        name: 'AXIS',
        options: [
          ['x', 'x'],
          ['y', 'y'],
          ['z', 'z']
        ]
      }
    ],
    output: 'Number',
    colour: C.input
  },
  {
    type: 'rfa_temperature',
    message0: '%{BKY_BLOCK_TEMPERATURE}',
    output: 'Number',
    colour: C.input
  },
  // Loops
  {
    type: 'rfa_repeat',
    message0: '%{BKY_BLOCK_REPEAT}',
    args0: [value('TIMES', 'Number')],
    message1: '%{BKY_BLOCK_DO} %1',
    args1: [doInput()],
    ...statement,
    colour: C.loops
  },
  {
    type: 'rfa_while',
    message0: '%{BKY_BLOCK_WHILE}',
    args0: [value('COND', 'Boolean')],
    message1: '%{BKY_BLOCK_DO} %1',
    args1: [doInput()],
    ...statement,
    colour: C.loops
  },
  // Logic
  {
    type: 'rfa_if',
    message0: '%{BKY_BLOCK_IF}',
    args0: [value('COND', 'Boolean')],
    message1: '%1',
    args1: [doInput('THEN')],
    ...statement,
    colour: C.logic
  },
  {
    type: 'rfa_if_else',
    message0: '%{BKY_BLOCK_IF}',
    args0: [value('COND', 'Boolean')],
    message1: '%1',
    args1: [doInput('THEN')],
    message2: '%{BKY_BLOCK_ELSE}',
    message3: '%1',
    args3: [doInput('ELSE')],
    ...statement,
    colour: C.logic
  },
  {
    type: 'rfa_compare',
    message0: '%1 %2 %3',
    args0: [
      value('A'),
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['=', 'eq'],
          ['≠', 'neq'],
          ['<', 'lt'],
          ['≤', 'lte'],
          ['>', 'gt'],
          ['≥', 'gte']
        ]
      },
      value('B')
    ],
    inputsInline: true,
    output: 'Boolean',
    colour: C.logic
  },
  {
    type: 'rfa_logic',
    message0: '%1 %2 %3',
    args0: [
      value('A', 'Boolean'),
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['%{BKY_BLOCK_AND}', 'and'],
          ['%{BKY_BLOCK_OR}', 'or']
        ]
      },
      value('B', 'Boolean')
    ],
    inputsInline: true,
    output: 'Boolean',
    colour: C.logic
  },
  {
    type: 'rfa_not',
    message0: '%{BKY_BLOCK_NOT}',
    args0: [value('A', 'Boolean')],
    output: 'Boolean',
    colour: C.logic
  },
  {
    type: 'rfa_bool',
    message0: '%1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'BOOL',
        options: [
          ['%{BKY_BLOCK_TRUE}', 'TRUE'],
          ['%{BKY_BLOCK_FALSE}', 'FALSE']
        ]
      }
    ],
    output: 'Boolean',
    colour: C.logic
  },
  // Variables
  {
    type: 'rfa_var_get',
    message0: '%1',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item' }],
    output: null,
    colour: C.variables
  },
  {
    type: 'rfa_var_set',
    message0: '%{BKY_BLOCK_SET}',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item' }, value('VALUE')],
    ...statement,
    colour: C.variables
  },
  {
    type: 'rfa_var_change',
    message0: '%{BKY_BLOCK_CHANGE}',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item' }, value('BY', 'Number')],
    ...statement,
    colour: C.variables
  },
  // Math
  {
    type: 'rfa_number',
    message0: '%1',
    args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
    output: 'Number',
    colour: C.math
  },
  {
    type: 'rfa_text',
    message0: '“%1”',
    args0: [{ type: 'field_input', name: 'TEXT', text: '' }],
    output: 'String',
    colour: C.basic
  },
  {
    type: 'rfa_arith',
    message0: '%1 %2 %3',
    args0: [
      value('A', 'Number'),
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['+', '+'],
          ['−', '-'],
          ['×', '*'],
          ['÷', '/']
        ]
      },
      value('B', 'Number')
    ],
    inputsInline: true,
    output: 'Number',
    colour: C.math
  },
  {
    type: 'rfa_random',
    message0: '%{BKY_BLOCK_RANDOM}',
    args0: [value('FROM', 'Number'), value('TO', 'Number')],
    inputsInline: true,
    output: 'Number',
    colour: C.math
  },
  // Pins and motors
  {
    type: 'rfa_digital_write',
    message0: '%{BKY_BLOCK_DIGITAL_WRITE}',
    args0: [
      {
        type: 'field_dropdown',
        name: 'PIN',
        options: [
          ['P0', '0'],
          ['P1', '1'],
          ['P2', '2']
        ]
      },
      {
        type: 'field_dropdown',
        name: 'VALUE',
        options: [
          ['0', '0'],
          ['1', '1']
        ]
      }
    ],
    ...statement,
    colour: C.pins
  },
  {
    type: 'rfa_motor',
    message0: '%{BKY_BLOCK_MOTOR}',
    args0: [
      {
        type: 'field_dropdown',
        name: 'ACTION',
        options: [
          ['%{BKY_BLOCK_MOTOR_FORWARD}', 'forward'],
          ['%{BKY_BLOCK_MOTOR_REVERSE}', 'reverse'],
          ['%{BKY_BLOCK_MOTOR_STOP}', 'stop']
        ]
      }
    ],
    ...statement,
    colour: C.motors,
    tooltip: '%{BKY_BLOCK_MOTOR_TIP}'
  }
] as const;

/** Message key for an extra block's text: x_play_tone → BLOCK_PLAY_TONE. */
export const extraMessageKey = (spec: NodeSpec) => `BLOCK_${spec.type.slice(2).toUpperCase()}`;

function extraArg(f: FieldSpec): object | undefined {
  switch (f.kind) {
    case 'expr':
      return value(f.input, f.check);
    case 'enum':
      return { type: 'field_dropdown', name: f.field, options: f.options.map((o) => [o[0], o[1]]) };
    case 'int':
      return {
        type: 'field_number',
        name: f.field,
        value: f.value,
        min: f.min,
        max: f.max,
        precision: 1
      };
    case 'text':
    case 'ident':
      return { type: 'field_input', name: f.field, text: f.value };
    default:
      return undefined;
  }
}

/** Blockly definitions for the MakeCode-level blocks in extra.ts. */
function extraDefinition(spec: NodeSpec): Record<string, unknown> {
  const def: Record<string, unknown> = {
    type: `rfa_${spec.type}`,
    message0: `%{BKY_${extraMessageKey(spec)}}`,
    args0: spec.fields.map(extraArg).filter(Boolean),
    colour: C[spec.category],
    ...(spec.v2
      ? { tooltip: '%{BKY_NEEDS_NEW_MICROBIT}' }
      : spec.tip
        ? { tooltip: `%{BKY_${spec.tip}}` }
        : {})
  };
  let line = 1;
  const leds = spec.fields.find((f) => f.kind === 'leds');
  if (leds) {
    for (let row = 0; row < 5; row += 1) {
      def[`message${line}`] = '%1 %2 %3 %4 %5';
      def[`args${line}`] = [0, 1, 2, 3, 4].map((col) => ({
        type: 'field_checkbox',
        name: `L${row * 5 + col}`,
        checked: false
      }));
      line += 1;
    }
  }
  for (const f of spec.fields) {
    if (f.kind === 'stmts') {
      def[`message${line}`] = '%1';
      def[`args${line}`] = [{ type: 'input_statement', name: f.input }];
      line += 1;
    }
  }
  if (spec.role === 'stmt') Object.assign(def, statement);
  if (spec.role === 'expr') def['output'] = spec.output;
  if (spec.fields.filter((f) => f.kind === 'expr').length > 1 && spec.role === 'expr') {
    def['inputsInline'] = true;
  }
  return def;
}

export const BLOCK_DEFINITIONS: readonly object[] = [
  ...CORE_DEFINITIONS,
  ...EXTRA_SPECS.map(extraDefinition)
];

/** Every %{BKY_KEY} the blocks use, so tests can check each has an English message. */
export function messageKeys(): string[] {
  const keys = new Set<string>();
  for (const match of JSON.stringify(BLOCK_DEFINITIONS).matchAll(/%\{BKY_([A-Z0-9_]+)\}/g)) {
    keys.add(match[1] ?? '');
  }
  return [...keys];
}
