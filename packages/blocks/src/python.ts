// Program JSON → MicroPython for the BBC micro:bit (M3 spec FR-3).
//
// How events run (the same rules as the interpreter, so the virtual micro:bit and the real one
// behave alike): "on start" blocks run first, top to bottom. Then one loop repeats for ever:
// every "forever" block's body in order, then each "on button pressed" block whose button was
// pressed since the last check, then a 20 ms rest (like MakeCode's forever loop). A press is
// never missed, but it is handled after the current "forever" body finishes.
import type { Expr, GenericNode, Handler, Program, Stmt } from './program';
import { EXTRA_BY_TYPE, type HandlerSpec, type PyContext } from './extra';
import { MODULES } from './modules';
import { variableNames } from './program';

const INDENT = '    ';

/** Names a learner's variable can't use as-is in Python. */
const RESERVED = new Set([
  // Python keywords and built-ins learners might shadow
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
  'print',
  'str',
  'int',
  'len',
  'range',
  'list',
  'abs',
  'min',
  'max',
  'type',
  'id',
  // micro:bit names used by generated code
  'display',
  'Image',
  'sleep',
  'button_a',
  'button_b',
  'pin0',
  'pin1',
  'pin2',
  'accelerometer',
  'temperature',
  'random',
  'microbit',
  'running_time'
]);

/** Turns learner variable names ("my score") into unique, valid Python names ("my_score"). */
export function pythonNames(names: string[]): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const name of names) {
    let base = name.trim().replace(/[^A-Za-z0-9_]+/g, '_');
    // Trim leading and trailing "_" without a backtracking regular expression.
    let start = 0;
    let end = base.length;
    while (start < end && base[start] === '_') start += 1;
    while (end > start && base[end - 1] === '_') end -= 1;
    base = base.slice(start, end);
    if (!base) base = 'value';
    if (/^[0-9]/.test(base) || RESERVED.has(base) || base.startsWith('_')) base = `v_${base}`;
    let candidate = base;
    for (let i = 2; used.has(candidate); i += 1) candidate = `${base}_${i}`;
    used.add(candidate);
    out.set(name, candidate);
  }
  return out;
}

/** A Python string literal that a learner's text can never break out of. */
export function pythonString(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

// JavaScript and Python write numbers the same way, except very large or small ones (1e+21),
// which Python also reads correctly.
const pythonNumber = (n: number): string => String(n);

const COMPARE = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;

/** Generates MicroPython source for a validated program. */
export function toPython(program: Program): string {
  const names = pythonNames(variableNames(program));
  const uses = { random: false, number: false };
  const modules = new Set<string>();
  const counters = new Map<string, number>();
  const unique = (base: string) => {
    const i = counters.get(base) ?? 0;
    counters.set(base, i + 1);
    return `${base}_${i}`;
  };
  const context = (depth: number): PyContext => ({
    expr: (e) => expr(e),
    bare: (e) => bare(e),
    block: (list, d) => block(list, d),
    pad: INDENT.repeat(depth),
    use: (name) => {
      if (name === 'random') uses.random = true;
      else if (name === 'number') uses.number = true;
      else modules.add(name);
    },
    unique
  });
  const specFor = (node: GenericNode) => EXTRA_BY_TYPE.get(node.type);

  const expr = (e: Expr): string => {
    switch (e.type) {
      case 'number':
        return pythonNumber(e.value);
      case 'text':
        return pythonString(e.value);
      case 'bool':
        return e.value ? 'True' : 'False';
      case 'var':
        return names.get(e.name) ?? 'None';
      case 'arith':
        return `(${expr(e.a)} ${e.op} ${expr(e.b)})`;
      case 'compare':
        return `(${expr(e.a)} ${COMPARE[e.op]} ${expr(e.b)})`;
      case 'logic':
        return `(${expr(e.a)} ${e.op} ${expr(e.b)})`;
      case 'not':
        return `(not ${expr(e.a)})`;
      case 'random':
        uses.random = true;
        return `random.randint(${expr(e.from)}, ${expr(e.to)})`;
      case 'button_pressed':
        return `button_${e.button.toLowerCase()}.is_pressed()`;
      case 'light_level':
        return 'display.read_light_level()';
      case 'acceleration':
        return `accelerometer.get_${e.axis}()`;
      case 'temperature':
        return 'temperature()';
      default: {
        const spec = specFor(e);
        return spec?.role === 'expr' ? spec.py(e, context(0)) : 'None';
      }
    }
  };

  // Without the outer brackets, for readability: "if light < 50:" rather than "if (light < 50):".
  const bare = (e: Expr): string => {
    const text = expr(e);
    return ['arith', 'compare', 'logic', 'not'].includes(e.type) ? text.slice(1, -1) : text;
  };

  const block = (list: Stmt[], depth: number): string[] => {
    const pad = INDENT.repeat(depth);
    if (list.length === 0) return [`${pad}pass`];
    return list.flatMap((s) => stmt(s, depth));
  };

  const stmt = (s: Stmt, depth: number): string[] => {
    const pad = INDENT.repeat(depth);
    switch (s.type) {
      case 'show_icon':
        return [`${pad}display.show(Image.${s.icon})`];
      case 'show_number':
        uses.number = true;
        return [`${pad}display.scroll(_number(${bare(s.value)}))`];
      case 'show_text':
        return [
          s.value.type === 'text'
            ? `${pad}display.scroll(${expr(s.value)})`
            : `${pad}display.scroll(str(${bare(s.value)}))`
        ];
      case 'clear':
        return [`${pad}display.clear()`];
      case 'pause':
        return [`${pad}sleep(${bare(s.ms)})`];
      case 'repeat':
        return [
          s.times.type === 'number' && Number.isInteger(s.times.value)
            ? `${pad}for _ in range(${s.times.value}):`
            : `${pad}for _ in range(int(${bare(s.times)})):`,
          ...block(s.body, depth + 1)
        ];
      case 'while':
        return [`${pad}while ${bare(s.cond)}:`, ...block(s.body, depth + 1)];
      case 'if': {
        const lines = [`${pad}if ${bare(s.cond)}:`, ...block(s.then, depth + 1)];
        if (s.else.length) lines.push(`${pad}else:`, ...block(s.else, depth + 1));
        return lines;
      }
      case 'set':
        return [`${pad}${names.get(s.name)} = ${bare(s.value)}`];
      case 'change':
        return [`${pad}${names.get(s.name)} += ${bare(s.by)}`];
      case 'digital_write':
        return [`${pad}pin${s.pin}.write_digital(${s.value})`];
      case 'motor': {
        const [a, b] = s.action === 'forward' ? [1, 0] : s.action === 'reverse' ? [0, 1] : [0, 0];
        return [`${pad}pin0.write_digital(${a})`, `${pad}pin1.write_digital(${b})`];
      }
      default: {
        const spec = specFor(s);
        return spec?.role === 'stmt' ? spec.py(s, context(depth)) : [];
      }
    }
  };

  const of = <T extends Handler['type']>(type: T) =>
    program.handlers.filter((h): h is Extract<Handler, { type: T }> => h.type === type);
  const generics = program.handlers.filter((h): h is GenericNode => h.type.startsWith('x_'));

  // Main-loop parts are generated first, so we know which modules and helpers they use.
  const loop: string[] = [];
  const setup: string[] = [];
  for (const h of of('forever')) loop.push(`${INDENT}# forever`, ...block(h.body, 1));
  const radioHandlers = generics.filter(
    (h) => h.type === 'x_on_radio_number' || h.type === 'x_on_radio_string'
  );
  if (radioHandlers.length) {
    loop.push(
      `${INDENT}# radio`,
      `${INDENT}_radio_text = radio.receive()`,
      `${INDENT}_radio_number = None`,
      `${INDENT}if _radio_text is not None:`,
      `${INDENT}${INDENT}try:`,
      `${INDENT}${INDENT}${INDENT}_radio_number = float(_radio_text)`,
      `${INDENT}${INDENT}${INDENT}receivedNumber = _radio_number`,
      `${INDENT}${INDENT}${INDENT}_radio_text = None`,
      `${INDENT}${INDENT}except ValueError:`,
      `${INDENT}${INDENT}${INDENT}receivedString = _radio_text`
    );
  }
  for (const h of of('on_button')) {
    loop.push(
      `${INDENT}# on button ${h.button} pressed`,
      `${INDENT}if button_${h.button.toLowerCase()}.was_pressed():`,
      ...block(h.body, 2)
    );
  }
  for (const h of generics) {
    const spec = specFor(h);
    if (spec?.role !== 'handler') continue;
    const parts = (spec as HandlerSpec).loop(h, context(1));
    setup.push(...(parts.setup ?? []));
    loop.push(
      `${INDENT}# ${h.type.slice(2).replace(/_/g, ' ')}`,
      ...(parts.before ?? []).map((l) => `${INDENT}${l}`),
      `${INDENT}if ${parts.cond}:`,
      ...(parts.afterTrue ?? []).map((l) => `${INDENT}${INDENT}${l}`),
      ...block((h['body'] as Stmt[]) ?? [], 2),
      ...(parts.after ?? []).map((l) => `${INDENT}${l}`)
    );
  }

  const starts: string[] = [];
  for (const h of of('on_start')) starts.push(...(h.body.length ? block(h.body, 0) : []));

  const functions: { name: string; lines: string[] }[] = generics
    .filter((h) => h.type === 'x_function')
    .map((h) => ({ name: String(h['name']), lines: block((h['body'] as Stmt[]) ?? [], 1) }));

  const variables = [...names.values()];
  const globals = [
    ...variables,
    ...(radioHandlers.length ? ['receivedNumber', 'receivedString'] : []),
    ...(modules.has('neopixel') ? ['strip'] : [])
  ];

  const body: string[] = [];
  if (variables.length || radioHandlers.length) {
    body.push('', '# Variables start at 0, like in the blocks.');
    for (const v of variables) body.push(`${v} = 0`);
    if (radioHandlers.length) body.push('receivedNumber = 0', 'receivedString = ""');
  }
  for (const f of functions) {
    body.push('', '', `def ${f.name}():`);
    if (globals.length) body.push(`${INDENT}global ${globals.join(', ')}`);
    body.push(...f.lines);
  }
  if (functions.length) body.push('');
  if (modules.has('radio')) body.push('', 'radio.on()');
  if (starts.length) body.push('', '# on start', ...starts);
  if (loop.length) {
    body.push('', ...setup, 'while True:', ...loop, `${INDENT}sleep(20)`);
  }

  const head = ['# Made with the Robot For All block editor', 'from microbit import *'];
  for (const m of ['music', 'radio', 'math', 'neopixel', 'game'])
    if (modules.has(m)) head.push(`import ${m}`);
  if (uses.random) head.push('import random');
  if (uses.number) {
    head.push(
      '',
      '',
      'def _number(n):',
      `${INDENT}# Show 4 rather than 4.0, like the blocks do.`,
      `${INDENT}return str(int(n)) if n == int(n) else str(n)`,
      ''
    );
  }
  // Variables can be changed inside loops at the top level, so no "global" is needed.
  return `${[...head, ...body].join('\n')}\n`;
}

/**
 * Every file the micro:bit needs for a program: main.py, plus our own modules it imports
 * (e.g. game.py for the Game blocks). Works for typed Python too.
 */
export function filesFor(mainPy: string): Record<string, string> {
  const files: Record<string, string> = { 'main.py': mainPy };
  for (const [name, source] of Object.entries(MODULES)) {
    if (new RegExp(`^\\s*(import ${name}\\b|from ${name} import)`, 'm').test(mainPy)) {
      files[`${name}.py`] = source;
    }
  }
  return files;
}

