// The program model (M3 spec FR-2). Blocks are saved as this small JSON tree, not as Blockly's
// own format, so programs can be validated, turned into MicroPython and run on the virtual
// micro:bit without Blockly. Everything here is pure TypeScript with no dependencies.
import { ICON_NAMES, type IconName } from './icons';

export const PROGRAM_VERSION = 1;

export type Button = 'A' | 'B';
export type Pin = 0 | 1 | 2;

export type Expr =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'var'; name: string }
  | { type: 'arith'; op: '+' | '-' | '*' | '/'; a: Expr; b: Expr }
  | { type: 'compare'; op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'; a: Expr; b: Expr }
  | { type: 'logic'; op: 'and' | 'or'; a: Expr; b: Expr }
  | { type: 'not'; a: Expr }
  | { type: 'random'; from: Expr; to: Expr }
  | { type: 'button_pressed'; button: Button }
  | { type: 'light_level' }
  | { type: 'acceleration'; axis: 'x' | 'y' | 'z' }
  | { type: 'temperature' };

export type Stmt =
  | { type: 'show_icon'; icon: IconName }
  | { type: 'show_number'; value: Expr }
  | { type: 'show_text'; value: Expr }
  | { type: 'clear' }
  | { type: 'pause'; ms: Expr }
  | { type: 'repeat'; times: Expr; body: Stmt[] }
  | { type: 'while'; cond: Expr; body: Stmt[] }
  | { type: 'if'; cond: Expr; then: Stmt[]; else: Stmt[] }
  | { type: 'set'; name: string; value: Expr }
  | { type: 'change'; name: string; by: Expr }
  | { type: 'digital_write'; pin: Pin; value: 0 | 1 }
  | { type: 'motor'; action: 'forward' | 'reverse' | 'stop' };

export type Handler =
  | { type: 'on_start'; body: Stmt[] }
  | { type: 'forever'; body: Stmt[] }
  | { type: 'on_button'; button: Button; body: Stmt[] };

export interface Program {
  version: typeof PROGRAM_VERSION;
  handlers: Handler[];
}

/** Limits for untrusted programs (imported files, M3 spec §8). */
export const LIMITS = { nodes: 2000, depth: 40, text: 200, nameLength: 30 } as const;

export class ProgramError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(`${path}: ${message}`);
    this.name = 'ProgramError';
    this.path = path;
  }
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const NAME = new RegExp(`^[\\p{L}\\p{N}_ ]{1,${LIMITS.nameLength}}$`, 'u');

/**
 * Checks an untrusted value (e.g. an imported file) and returns a clean Program.
 * Unknown block types, extra fields, oversized or deeply nested programs are rejected.
 */
export function parseProgram(input: unknown): Program {
  let nodes = 0;
  const count = (path: string, depth: number) => {
    nodes += 1;
    if (nodes > LIMITS.nodes) throw new ProgramError('program is too big', path);
    if (depth > LIMITS.depth) throw new ProgramError('blocks are nested too deeply', path);
  };
  const fields = (v: unknown, path: string, allowed: string[]): Json => {
    if (!isObject(v)) throw new ProgramError('expected an object', path);
    for (const key of Object.keys(v)) {
      if (!allowed.includes(key)) throw new ProgramError(`unknown field "${key}"`, path);
    }
    return v;
  };
  const oneOf = <T>(v: unknown, options: readonly T[], path: string): T => {
    if (!options.includes(v as T))
      throw new ProgramError(`expected one of ${options.join(', ')}`, path);
    return v as T;
  };
  const name = (v: unknown, path: string): string => {
    if (typeof v !== 'string' || !NAME.test(v) || v.trim() === '') {
      throw new ProgramError('variable names use letters, numbers, spaces or _', path);
    }
    return v;
  };

  const expr = (v: unknown, path: string, depth: number): Expr => {
    count(path, depth);
    const t = isObject(v) ? v['type'] : undefined;
    const d = depth + 1;
    switch (t) {
      case 'number': {
        const o = fields(v, path, ['type', 'value']);
        if (typeof o['value'] !== 'number' || !Number.isFinite(o['value'])) {
          throw new ProgramError('expected a number', `${path}.value`);
        }
        return { type: 'number', value: o['value'] };
      }
      case 'text': {
        const o = fields(v, path, ['type', 'value']);
        if (typeof o['value'] !== 'string' || o['value'].length > LIMITS.text) {
          throw new ProgramError(`expected text up to ${LIMITS.text} characters`, `${path}.value`);
        }
        return { type: 'text', value: o['value'] };
      }
      case 'bool': {
        const o = fields(v, path, ['type', 'value']);
        if (typeof o['value'] !== 'boolean') throw new ProgramError('expected true or false', path);
        return { type: 'bool', value: o['value'] };
      }
      case 'var':
        return {
          type: 'var',
          name: name(fields(v, path, ['type', 'name'])['name'], `${path}.name`)
        };
      case 'arith': {
        const o = fields(v, path, ['type', 'op', 'a', 'b']);
        return {
          type: 'arith',
          op: oneOf(o['op'], ['+', '-', '*', '/'] as const, `${path}.op`),
          a: expr(o['a'], `${path}.a`, d),
          b: expr(o['b'], `${path}.b`, d)
        };
      }
      case 'compare': {
        const o = fields(v, path, ['type', 'op', 'a', 'b']);
        return {
          type: 'compare',
          op: oneOf(o['op'], ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'] as const, `${path}.op`),
          a: expr(o['a'], `${path}.a`, d),
          b: expr(o['b'], `${path}.b`, d)
        };
      }
      case 'logic': {
        const o = fields(v, path, ['type', 'op', 'a', 'b']);
        return {
          type: 'logic',
          op: oneOf(o['op'], ['and', 'or'] as const, `${path}.op`),
          a: expr(o['a'], `${path}.a`, d),
          b: expr(o['b'], `${path}.b`, d)
        };
      }
      case 'not':
        return { type: 'not', a: expr(fields(v, path, ['type', 'a'])['a'], `${path}.a`, d) };
      case 'random': {
        const o = fields(v, path, ['type', 'from', 'to']);
        return {
          type: 'random',
          from: expr(o['from'], `${path}.from`, d),
          to: expr(o['to'], `${path}.to`, d)
        };
      }
      case 'button_pressed': {
        const o = fields(v, path, ['type', 'button']);
        return {
          type: 'button_pressed',
          button: oneOf(o['button'], ['A', 'B'] as const, `${path}.button`)
        };
      }
      case 'light_level':
        fields(v, path, ['type']);
        return { type: 'light_level' };
      case 'acceleration': {
        const o = fields(v, path, ['type', 'axis']);
        return {
          type: 'acceleration',
          axis: oneOf(o['axis'], ['x', 'y', 'z'] as const, `${path}.axis`)
        };
      }
      case 'temperature':
        fields(v, path, ['type']);
        return { type: 'temperature' };
      default:
        throw new ProgramError(`unknown value block "${String(t)}"`, path);
    }
  };

  const stmts = (v: unknown, path: string, depth: number): Stmt[] => {
    if (!Array.isArray(v)) throw new ProgramError('expected a list of blocks', path);
    return v.map((s, i) => stmt(s, `${path}[${i}]`, depth));
  };

  const stmt = (v: unknown, path: string, depth: number): Stmt => {
    count(path, depth);
    const t = isObject(v) ? v['type'] : undefined;
    const d = depth + 1;
    switch (t) {
      case 'show_icon': {
        const o = fields(v, path, ['type', 'icon']);
        return { type: 'show_icon', icon: oneOf(o['icon'], ICON_NAMES, `${path}.icon`) };
      }
      case 'show_number': {
        const o = fields(v, path, ['type', 'value']);
        return { type: 'show_number', value: expr(o['value'], `${path}.value`, d) };
      }
      case 'show_text': {
        const o = fields(v, path, ['type', 'value']);
        return { type: 'show_text', value: expr(o['value'], `${path}.value`, d) };
      }
      case 'clear':
        fields(v, path, ['type']);
        return { type: 'clear' };
      case 'pause':
        return { type: 'pause', ms: expr(fields(v, path, ['type', 'ms'])['ms'], `${path}.ms`, d) };
      case 'repeat': {
        const o = fields(v, path, ['type', 'times', 'body']);
        return {
          type: 'repeat',
          times: expr(o['times'], `${path}.times`, d),
          body: stmts(o['body'], `${path}.body`, d)
        };
      }
      case 'while': {
        const o = fields(v, path, ['type', 'cond', 'body']);
        return {
          type: 'while',
          cond: expr(o['cond'], `${path}.cond`, d),
          body: stmts(o['body'], `${path}.body`, d)
        };
      }
      case 'if': {
        const o = fields(v, path, ['type', 'cond', 'then', 'else']);
        return {
          type: 'if',
          cond: expr(o['cond'], `${path}.cond`, d),
          then: stmts(o['then'], `${path}.then`, d),
          else: stmts(o['else'] ?? [], `${path}.else`, d)
        };
      }
      case 'set': {
        const o = fields(v, path, ['type', 'name', 'value']);
        return {
          type: 'set',
          name: name(o['name'], `${path}.name`),
          value: expr(o['value'], `${path}.value`, d)
        };
      }
      case 'change': {
        const o = fields(v, path, ['type', 'name', 'by']);
        return {
          type: 'change',
          name: name(o['name'], `${path}.name`),
          by: expr(o['by'], `${path}.by`, d)
        };
      }
      case 'digital_write': {
        const o = fields(v, path, ['type', 'pin', 'value']);
        return {
          type: 'digital_write',
          pin: oneOf(o['pin'], [0, 1, 2] as const, `${path}.pin`),
          value: oneOf(o['value'], [0, 1] as const, `${path}.value`)
        };
      }
      case 'motor': {
        const o = fields(v, path, ['type', 'action']);
        return {
          type: 'motor',
          action: oneOf(o['action'], ['forward', 'reverse', 'stop'] as const, `${path}.action`)
        };
      }
      default:
        throw new ProgramError(`unknown block "${String(t)}"`, path);
    }
  };

  const handler = (v: unknown, path: string): Handler => {
    count(path, 0);
    const t = isObject(v) ? v['type'] : undefined;
    if (t === 'on_start' || t === 'forever') {
      return { type: t, body: stmts(fields(v, path, ['type', 'body'])['body'], `${path}.body`, 1) };
    }
    if (t === 'on_button') {
      const o = fields(v, path, ['type', 'button', 'body']);
      return {
        type: 'on_button',
        button: oneOf(o['button'], ['A', 'B'] as const, `${path}.button`),
        body: stmts(o['body'], `${path}.body`, 1)
      };
    }
    throw new ProgramError(`unknown event block "${String(t)}"`, path);
  };

  const root = fields(input, 'program', ['version', 'handlers']);
  if (root['version'] !== PROGRAM_VERSION) {
    throw new ProgramError(`unsupported version ${String(root['version'])}`, 'program.version');
  }
  if (!Array.isArray(root['handlers']))
    throw new ProgramError('expected a list', 'program.handlers');
  return {
    version: PROGRAM_VERSION,
    handlers: root['handlers'].map((h, i) => handler(h, `handlers[${i}]`))
  };
}

/** Every variable name used in a program, in first-use order. */
export function variableNames(program: Program): string[] {
  const names = new Set<string>();
  const inExpr = (e: Expr): void => {
    if (e.type === 'var') names.add(e.name);
    for (const key of ['a', 'b', 'from', 'to'] as const) {
      const child = (e as Record<string, unknown>)[key];
      if (child) inExpr(child as Expr);
    }
  };
  const inStmts = (list: Stmt[]): void => {
    for (const s of list) {
      if (s.type === 'set' || s.type === 'change') names.add(s.name);
      for (const key of ['value', 'ms', 'times', 'cond', 'by'] as const) {
        const child = (s as Record<string, unknown>)[key];
        if (child && typeof child === 'object') inExpr(child as Expr);
      }
      for (const key of ['body', 'then', 'else'] as const) {
        const child = (s as Record<string, unknown>)[key];
        if (Array.isArray(child)) inStmts(child as Stmt[]);
      }
    }
  };
  for (const h of program.handlers) inStmts(h.body);
  return [...names];
}
