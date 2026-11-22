// The block menu (toolbox), laid out like MakeCode for micro:bit: Basic, Input, Music, LED,
// Radio, Loops, Logic, Variables, Math, (our Motors), Extensions, then Advanced with Functions,
// Text, Pins, Serial and Control. Inputs come pre-filled with "shadow" blocks you can type over.
import { CATEGORY_COLOURS as C, type Category } from '../colours';
import { EXTRA_SPECS, type FieldSpec, type NodeSpec } from '../extra';
import type { Expr } from '../program';

const num = (value: number) => ({ shadow: { type: 'rfa_number', fields: { NUM: value } } });
const text = (value: string) => ({ shadow: { type: 'rfa_text', fields: { TEXT: value } } });
const bool = () => ({ shadow: { type: 'rfa_bool', fields: { BOOL: 'TRUE' } } });
const block = (
  type: string,
  inputs?: Record<string, unknown>,
  fields?: Record<string, unknown>
) => ({
  kind: 'block',
  type,
  ...(inputs ? { inputs } : {}),
  ...(fields ? { fields } : {})
});

/** A shadow block for an extra block's default input. */
function shadowFor(e: Expr | undefined) {
  if (!e) return undefined;
  if (e.type === 'number') return num(e.value);
  if (e.type === 'text') return text(e.value);
  if (e.type === 'x_note')
    return { shadow: { type: 'rfa_x_note', fields: { NOTE: String(e['note']) } } };
  if (e.type === 'x_icon_image') {
    return { shadow: { type: 'rfa_x_icon_image', fields: { ICON: String(e['icon']) } } };
  }
  if (e.type === 'x_colour') {
    return {
      shadow: { type: 'rfa_x_colour', fields: { COLOUR: String(e['colour']) } }
    };
  }
  return undefined;
}

function extraBlock(spec: NodeSpec) {
  const inputs: Record<string, unknown> = {};
  for (const f of spec.fields as readonly FieldSpec[]) {
    if (f.kind === 'expr') {
      const shadow = shadowFor(f.shadow);
      if (shadow) inputs[f.input] = shadow;
    }
  }
  return block(`rfa_${spec.type}`, Object.keys(inputs).length ? inputs : undefined);
}

const extras = (category: Category) =>
  EXTRA_SPECS.filter((s) => s.category === category).map(extraBlock);
const byType = (type: string) => {
  const spec = EXTRA_SPECS.find((s) => s.type === type);
  if (!spec) throw new Error(`No block ${type}`);
  return extraBlock(spec);
};

/** Category label and icon classes, styled in the editor's stylesheet (no inline styles). */
const category = (
  id: string,
  colour: string,
  contents: unknown[] | undefined,
  extra: Record<string, unknown> = {}
) => ({
  kind: 'category',
  name: `%{BKY_CATEGORY_${id.toUpperCase()}}`,
  colour,
  cssconfig: {
    row: `blocklyToolboxCategory rfaCategory rfaCategory-${id}`,
    icon: `blocklyToolboxCategoryIcon rfaIcon rfaIcon-${id}`,
    label: 'blocklyToolboxCategoryLabel rfaLabel'
  },
  ...(contents ? { contents } : {}),
  ...extra
});

export const EXTENSIONS = ['neopixel', 'motordriver'] as const;
export type Extension = (typeof EXTENSIONS)[number];

/** The toolbox, with the categories of any extensions the program has added. */
export function toolbox(added: readonly Extension[] = []) {
  return {
    kind: 'categoryToolbox',
    contents: [
      category('basic', C.basic, [
        block('rfa_show_number', { NUM: num(0) }),
        byType('x_show_leds'),
        block('rfa_show_icon'),
        block('rfa_show_string', { TEXT: text('Hello!') }),
        block('rfa_clear'),
        block('rfa_on_start'),
        block('rfa_forever'),
        block('rfa_pause', { MS: num(100) }),
        byType('x_show_arrow')
      ]),
      category('input', C.input, [
        block('rfa_on_button'),
        byType('x_on_gesture'),
        byType('x_on_pin_pressed'),
        byType('x_on_logo_touched'),
        byType('x_on_loud_sound'),
        block('rfa_button_is_pressed'),
        byType('x_pin_is_pressed'),
        byType('x_logo_is_pressed'),
        block('rfa_acceleration'),
        block('rfa_light_level'),
        byType('x_compass_heading'),
        block('rfa_temperature'),
        byType('x_sound_level'),
        byType('x_running_time')
      ]),
      category('music', C.music, extras('music')),
      category('led', C.led, extras('led')),
      category('radio', C.radio, extras('radio')),
      category('loops', C.loops, [
        block('rfa_repeat', { TIMES: num(4) }),
        block('rfa_while', { COND: bool() }),
        byType('x_for_range'),
        byType('x_every'),
        byType('x_break'),
        byType('x_continue')
      ]),
      category('logic', C.logic, [
        block('rfa_if', { COND: bool() }),
        block('rfa_if_else', { COND: bool() }),
        block('rfa_compare', { A: num(0), B: num(0) }),
        block('rfa_logic'),
        block('rfa_not'),
        block('rfa_bool')
      ]),
      category('variables', C.variables, undefined, { custom: 'RFA_VARIABLES' }),
      category('math', C.math, [
        block('rfa_arith', { A: num(0), B: num(0) }),
        block('rfa_number'),
        byType('x_remainder'),
        byType('x_minmax'),
        byType('x_math_op'),
        block('rfa_random', { FROM: num(0), TO: num(10) }),
        byType('x_random_bool')
      ]),
      category('motors', C.motors, [
        block('rfa_motor', undefined, { ACTION: 'forward' }),
        block('rfa_motor', undefined, { ACTION: 'stop' }),
        block('rfa_motor', undefined, { ACTION: 'reverse' })
      ]),
      ...(added.includes('neopixel') ? [category('neopixel', C.neopixel, extras('neopixel'))] : []),
      ...(added.includes('motordriver')
        ? [category('motordriver', C.motordriver, extras('motordriver'))]
        : []),
      category('extensions', C.extensions, undefined, { custom: 'RFA_EXTENSIONS' }),
      category('advanced', C.advanced, [
        category('functions', C.functions, extras('functions')),
        category('arrays', C.arrays, extras('arrays')),
        category('text', C.text, extras('text')),
        category('game', C.game, extras('game')),
        category('images', C.images, extras('images')),
        category('pins', C.pins, [block('rfa_digital_write'), ...extras('pins')]),
        category('serial', C.serial, extras('serial')),
        category('control', C.control, [byType('x_reset'), byType('x_running_time')])
      ])
    ]
  };
}

/** The default toolbox (no extensions added). */
export const TOOLBOX = toolbox();

/** Blocks shown in the Variables category for each variable, after the "Make a variable" button. */
export function variableBlocks(variable: { name: string; id: string }) {
  return [
    block('rfa_var_set', { VALUE: num(0) }, { VAR: { id: variable.id } }),
    block('rfa_var_change', { BY: num(1) }, { VAR: { id: variable.id } }),
    block('rfa_var_get', undefined, { VAR: { id: variable.id } })
  ];
}

/** Every block in the toolbox, flattened, for the search box. */
export function allToolboxBlocks(box: { contents: unknown[] } = toolbox([...EXTENSIONS])) {
  const out: { kind: string; type: string }[] = [];
  const walk = (items: unknown[]) => {
    for (const item of items as Record<string, unknown>[]) {
      if (item['kind'] === 'block') out.push(item as { kind: string; type: string });
      if (Array.isArray(item['contents'])) walk(item['contents']);
    }
  };
  walk(box.contents);
  return out;
}
