// The block menu (toolbox), in MakeCode's category order. Inputs come pre-filled with "shadow"
// blocks (a number or text you can type over), like MakeCode.
import { CATEGORY_COLOURS as C } from '../colours';

const num = (value: number) => ({ shadow: { type: 'rfa_number', fields: { NUM: value } } });
const text = (value: string) => ({ shadow: { type: 'rfa_text', fields: { TEXT: value } } });
const bool = () => ({ shadow: { type: 'rfa_bool', fields: { BOOL: 'TRUE' } } });
const block = (type: string, inputs?: Record<string, unknown>, fields?: Record<string, unknown>) => ({
  kind: 'block',
  type,
  ...(inputs ? { inputs } : {}),
  ...(fields ? { fields } : {})
});

/** Category names are message keys, replaced with translated text by the editor. */
export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_BASIC}',
      colour: C.basic,
      contents: [
        block('rfa_show_number', { NUM: num(0) }),
        block('rfa_show_icon'),
        block('rfa_show_string', { TEXT: text('Hello!') }),
        block('rfa_clear'),
        block('rfa_on_start'),
        block('rfa_forever'),
        block('rfa_pause', { MS: num(100) })
      ]
    },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_INPUT}',
      colour: C.input,
      contents: [
        block('rfa_on_button'),
        block('rfa_button_is_pressed'),
        block('rfa_light_level'),
        block('rfa_acceleration'),
        block('rfa_temperature')
      ]
    },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_LOOPS}',
      colour: C.loops,
      contents: [block('rfa_repeat', { TIMES: num(4) }), block('rfa_while', { COND: bool() })]
    },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_LOGIC}',
      colour: C.logic,
      contents: [
        block('rfa_if', { COND: bool() }),
        block('rfa_if_else', { COND: bool() }),
        block('rfa_compare', { A: num(0), B: num(0) }),
        block('rfa_logic'),
        block('rfa_not'),
        block('rfa_bool')
      ]
    },
    { kind: 'category', name: '%{BKY_CATEGORY_VARIABLES}', colour: C.variables, custom: 'RFA_VARIABLES' },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_MATH}',
      colour: C.math,
      contents: [
        block('rfa_arith', { A: num(0), B: num(0) }),
        block('rfa_number'),
        block('rfa_random', { FROM: num(0), TO: num(10) })
      ]
    },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_PINS}',
      colour: C.pins,
      contents: [block('rfa_digital_write')]
    },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_MOTORS}',
      colour: C.motors,
      contents: [
        block('rfa_motor', undefined, { ACTION: 'forward' }),
        block('rfa_motor', undefined, { ACTION: 'stop' }),
        block('rfa_motor', undefined, { ACTION: 'reverse' })
      ]
    }
  ]
};

/** Blocks shown in the Variables category for each variable, after the "Make a variable" button. */
export function variableBlocks(variable: { name: string; id: string }) {
  return [
    block('rfa_var_set', { VALUE: num(0) }, { VAR: { id: variable.id } }),
    block('rfa_var_change', { BY: num(1) }, { VAR: { id: variable.id } }),
    block('rfa_var_get', undefined, { VAR: { id: variable.id } })
  ];
}
