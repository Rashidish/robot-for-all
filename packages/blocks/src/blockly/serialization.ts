// Converts between Blockly's saved-workspace JSON and our program JSON (M3 spec FR-2).
// Pure functions on plain objects, so they're tested without a browser.
// Blocks that aren't inside an event block ("on start", "forever", "on button") are left out,
// like MakeCode, which greys them out and doesn't run them.
import type { Button, Expr, Handler, Program, Stmt } from '../program';
import type { IconName } from '../icons';

export interface BlockJson {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block?: BlockJson; shadow?: BlockJson };
}

export interface WorkspaceJson {
  blocks?: { languageVersion?: number; blocks?: BlockJson[] };
  variables?: { name: string; id: string; type?: string }[];
}

// ---------- Blockly → program ----------

export function fromBlockly(workspace: WorkspaceJson): Program {
  const variables = new Map((workspace.variables ?? []).map((v) => [v.id, v.name]));
  const field = (b: BlockJson, name: string): unknown => b.fields?.[name];
  const varName = (b: BlockJson): string => {
    const f = field(b, 'VAR') as { id?: string } | undefined;
    return variables.get(f?.id ?? '') ?? 'item';
  };
  const input = (b: BlockJson, name: string): BlockJson | undefined =>
    b.inputs?.[name]?.block ?? b.inputs?.[name]?.shadow;

  const expr = (b: BlockJson | undefined, fallback: Expr): Expr => {
    if (!b) return fallback;
    const zero: Expr = { type: 'number', value: 0 };
    switch (b.type) {
      case 'rfa_number':
        return { type: 'number', value: Number(field(b, 'NUM') ?? 0) };
      case 'rfa_text':
        return { type: 'text', value: String(field(b, 'TEXT') ?? '') };
      case 'rfa_bool':
        return { type: 'bool', value: field(b, 'BOOL') !== 'FALSE' };
      case 'rfa_var_get':
        return { type: 'var', name: varName(b) };
      case 'rfa_arith':
        return {
          type: 'arith',
          op: field(b, 'OP') as '+' | '-' | '*' | '/',
          a: expr(input(b, 'A'), zero),
          b: expr(input(b, 'B'), zero)
        };
      case 'rfa_compare':
        return {
          type: 'compare',
          op: field(b, 'OP') as 'eq',
          a: expr(input(b, 'A'), zero),
          b: expr(input(b, 'B'), zero)
        };
      case 'rfa_logic':
        return {
          type: 'logic',
          op: field(b, 'OP') === 'or' ? 'or' : 'and',
          a: expr(input(b, 'A'), { type: 'bool', value: false }),
          b: expr(input(b, 'B'), { type: 'bool', value: false })
        };
      case 'rfa_not':
        return { type: 'not', a: expr(input(b, 'A'), { type: 'bool', value: false }) };
      case 'rfa_random':
        return { type: 'random', from: expr(input(b, 'FROM'), zero), to: expr(input(b, 'TO'), zero) };
      case 'rfa_button_is_pressed':
        return { type: 'button_pressed', button: field(b, 'BUTTON') as Button };
      case 'rfa_light_level':
        return { type: 'light_level' };
      case 'rfa_acceleration':
        return { type: 'acceleration', axis: field(b, 'AXIS') as 'x' };
      case 'rfa_temperature':
        return { type: 'temperature' };
      default:
        return fallback;
    }
  };

  const one = (b: BlockJson): Stmt | undefined => {
    const zero: Expr = { type: 'number', value: 0 };
    switch (b.type) {
      case 'rfa_show_number':
        return { type: 'show_number', value: expr(input(b, 'NUM'), zero) };
      case 'rfa_show_icon':
        return { type: 'show_icon', icon: field(b, 'ICON') as IconName };
      case 'rfa_show_string':
        return { type: 'show_text', value: expr(input(b, 'TEXT'), { type: 'text', value: '' }) };
      case 'rfa_clear':
        return { type: 'clear' };
      case 'rfa_pause':
        return { type: 'pause', ms: expr(input(b, 'MS'), zero) };
      case 'rfa_repeat':
        return { type: 'repeat', times: expr(input(b, 'TIMES'), zero), body: stack(input(b, 'DO')) };
      case 'rfa_while':
        return { type: 'while', cond: expr(input(b, 'COND'), { type: 'bool', value: false }), body: stack(input(b, 'DO')) };
      case 'rfa_if':
      case 'rfa_if_else':
        return {
          type: 'if',
          cond: expr(input(b, 'COND'), { type: 'bool', value: false }),
          then: stack(input(b, 'THEN')),
          else: b.type === 'rfa_if_else' ? stack(input(b, 'ELSE')) : []
        };
      case 'rfa_var_set':
        return { type: 'set', name: varName(b), value: expr(input(b, 'VALUE'), zero) };
      case 'rfa_var_change':
        return { type: 'change', name: varName(b), by: expr(input(b, 'BY'), zero) };
      case 'rfa_digital_write':
        return {
          type: 'digital_write',
          pin: Number(field(b, 'PIN')) as 0 | 1 | 2,
          value: Number(field(b, 'VALUE')) as 0 | 1
        };
      case 'rfa_motor':
        return { type: 'motor', action: field(b, 'ACTION') as 'forward' };
      default:
        return undefined;
    }
  };

  const stack = (first: BlockJson | undefined): Stmt[] => {
    const out: Stmt[] = [];
    for (let b = first; b; b = b.next?.block) {
      const s = one(b);
      if (s) out.push(s);
    }
    return out;
  };

  const handlers: Handler[] = [];
  const tops = [...(workspace.blocks?.blocks ?? [])].sort((p, q) => (p.y ?? 0) - (q.y ?? 0) || (p.x ?? 0) - (q.x ?? 0));
  for (const b of tops) {
    if (b.type === 'rfa_on_start') handlers.push({ type: 'on_start', body: stack(input(b, 'DO')) });
    if (b.type === 'rfa_forever') handlers.push({ type: 'forever', body: stack(input(b, 'DO')) });
    if (b.type === 'rfa_on_button') {
      handlers.push({ type: 'on_button', button: field(b, 'BUTTON') as Button, body: stack(input(b, 'DO')) });
    }
  }
  return { version: 1, handlers };
}

// ---------- program → Blockly ----------

const varId = (name: string) => `var-${name}`;

export function toBlockly(program: Program): WorkspaceJson {
  const names = new Set<string>();
  const shadowNumber = (value: number) => ({ shadow: { type: 'rfa_number', fields: { NUM: value } } });

  const exprInput = (e: Expr): { block?: BlockJson; shadow?: BlockJson } => {
    if (e.type === 'number') return shadowNumber(e.value);
    if (e.type === 'text') return { shadow: { type: 'rfa_text', fields: { TEXT: e.value } } };
    return { block: exprBlock(e) };
  };

  const exprBlock = (e: Expr): BlockJson => {
    switch (e.type) {
      case 'number':
        return { type: 'rfa_number', fields: { NUM: e.value } };
      case 'text':
        return { type: 'rfa_text', fields: { TEXT: e.value } };
      case 'bool':
        return { type: 'rfa_bool', fields: { BOOL: e.value ? 'TRUE' : 'FALSE' } };
      case 'var':
        names.add(e.name);
        return { type: 'rfa_var_get', fields: { VAR: { id: varId(e.name) } } };
      case 'arith':
      case 'compare':
      case 'logic':
        return {
          type: `rfa_${e.type}`,
          fields: { OP: e.op },
          inputs: { A: exprInput(e.a), B: exprInput(e.b) }
        };
      case 'not':
        return { type: 'rfa_not', inputs: { A: exprInput(e.a) } };
      case 'random':
        return { type: 'rfa_random', inputs: { FROM: exprInput(e.from), TO: exprInput(e.to) } };
      case 'button_pressed':
        return { type: 'rfa_button_is_pressed', fields: { BUTTON: e.button } };
      case 'light_level':
        return { type: 'rfa_light_level' };
      case 'acceleration':
        return { type: 'rfa_acceleration', fields: { AXIS: e.axis } };
      case 'temperature':
        return { type: 'rfa_temperature' };
    }
  };

  const stmtBlock = (s: Stmt): BlockJson => {
    switch (s.type) {
      case 'show_number':
        return { type: 'rfa_show_number', inputs: { NUM: exprInput(s.value) } };
      case 'show_icon':
        return { type: 'rfa_show_icon', fields: { ICON: s.icon } };
      case 'show_text':
        return { type: 'rfa_show_string', inputs: { TEXT: exprInput(s.value) } };
      case 'clear':
        return { type: 'rfa_clear' };
      case 'pause':
        return { type: 'rfa_pause', inputs: { MS: exprInput(s.ms) } };
      case 'repeat':
        return { type: 'rfa_repeat', inputs: { TIMES: exprInput(s.times), ...stackInput('DO', s.body) } };
      case 'while':
        return { type: 'rfa_while', inputs: { COND: exprInput(s.cond), ...stackInput('DO', s.body) } };
      case 'if':
        return s.else.length
          ? {
              type: 'rfa_if_else',
              inputs: { COND: exprInput(s.cond), ...stackInput('THEN', s.then), ...stackInput('ELSE', s.else) }
            }
          : { type: 'rfa_if', inputs: { COND: exprInput(s.cond), ...stackInput('THEN', s.then) } };
      case 'set':
        names.add(s.name);
        return { type: 'rfa_var_set', fields: { VAR: { id: varId(s.name) } }, inputs: { VALUE: exprInput(s.value) } };
      case 'change':
        names.add(s.name);
        return { type: 'rfa_var_change', fields: { VAR: { id: varId(s.name) } }, inputs: { BY: exprInput(s.by) } };
      case 'digital_write':
        return { type: 'rfa_digital_write', fields: { PIN: String(s.pin), VALUE: String(s.value) } };
      case 'motor':
        return { type: 'rfa_motor', fields: { ACTION: s.action } };
    }
  };

  const chain = (list: Stmt[]): BlockJson | undefined => {
    let first: BlockJson | undefined;
    let last: BlockJson | undefined;
    for (const s of list) {
      const b = stmtBlock(s);
      if (last) last.next = { block: b };
      else first = b;
      last = b;
    }
    return first;
  };

  const stackInput = (name: string, list: Stmt[]) => {
    const first = chain(list);
    return first ? { [name]: { block: first } } : {};
  };

  let y = 20;
  const tops: BlockJson[] = program.handlers.map((h) => {
    const top: BlockJson =
      h.type === 'on_button'
        ? { type: 'rfa_on_button', fields: { BUTTON: h.button }, inputs: stackInput('DO', h.body) }
        : { type: `rfa_${h.type}`, inputs: stackInput('DO', h.body) };
    top.x = 20;
    top.y = y;
    y += 60 + 40 * countStmts(h.body);
    return top;
  });

  return {
    blocks: { languageVersion: 0, blocks: tops },
    ...(names.size ? { variables: [...names].map((name) => ({ name, id: varId(name) })) } : {})
  };
}

function countStmts(list: Stmt[]): number {
  let n = 0;
  for (const s of list) {
    n += 1;
    if ('body' in s) n += countStmts(s.body);
    if (s.type === 'if') n += countStmts(s.then) + countStmts(s.else) + 1;
  }
  return n;
}

/** What a new program looks like: empty "on start" and "forever", like MakeCode. */
export const NEW_PROGRAM: Program = {
  version: 1,
  handlers: [
    { type: 'on_start', body: [] },
    { type: 'forever', body: [] }
  ]
};
