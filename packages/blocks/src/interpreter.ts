// Runs a program on the virtual micro:bit (M3 spec FR-4). It walks the program JSON; nothing is
// ever turned into JavaScript and evaluated, so the strict CSP (no unsafe-eval) still holds.
// Event rules match the MicroPython generator exactly (see python.ts), and CI checks both give
// the same sequence of LED, pin and pause actions.
import type { IconName } from './icons';
import type { Button, Expr, Handler, Pin, Program, Stmt } from './program';

/** What the program can do to a micro:bit (virtual or a test fake). */
export interface Device {
  show(icon: IconName): void;
  /** Scrolls text; may take time on the virtual micro:bit. */
  scroll(text: string): Promise<void>;
  clear(): void;
  writeDigital(pin: Pin, value: 0 | 1): void;
  isPressed(button: Button): boolean;
  /** True if the button was pressed since the last time this was asked (like MicroPython). */
  wasPressed(button: Button): boolean;
  lightLevel(): number;
  acceleration(axis: 'x' | 'y' | 'z'): number;
  temperature(): number;
}

/** Time, so tests can run a program instantly. */
export interface Clock {
  sleep(ms: number): Promise<void>;
  /** Lets the browser breathe during long loops that never pause; not a program action. */
  breathe(): Promise<void>;
}

/** Thrown to end a run: the Stop button, or a test's time limit. */
export class Stopped extends Error {
  constructor() {
    super('Program stopped');
    this.name = 'Stopped';
  }
}

/** A mistake in the learner's program, with a message key for the editor to show. */
export class RunError extends Error {
  readonly key: 'divide_by_zero';
  constructor(key: 'divide_by_zero') {
    super(key);
    this.name = 'RunError';
    this.key = key;
  }
}

type Value = number | string | boolean;

/** How the blocks show a number: 4 rather than 4.0 (same as _number in the Python). */
export function formatNumber(n: number): string {
  return String(n);
}

export interface RunOptions {
  signal?: AbortSignal;
  /** Random whole number from..to inclusive; replaceable for tests. */
  random?: (from: number, to: number) => number;
}

const STEPS_BEFORE_BREATHING = 1000;

export async function run(program: Program, device: Device, clock: Clock, options: RunOptions = {}) {
  const vars = new Map<string, Value>();
  const random =
    options.random ??
    ((from: number, to: number) => {
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      return lo + Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1));
    });
  let steps = 0;

  const check = async () => {
    if (options.signal?.aborted) throw new Stopped();
    steps += 1;
    if (steps >= STEPS_BEFORE_BREATHING) {
      steps = 0;
      await clock.breathe();
      if (options.signal?.aborted) throw new Stopped();
    }
  };
  const sleep = async (ms: number) => {
    steps = 0;
    await clock.sleep(ms);
    if (options.signal?.aborted) throw new Stopped();
  };

  const num = (v: Value): number => Number(v);
  const truthy = (v: Value): boolean => Boolean(v);

  const evaluate = (e: Expr): Value => {
    switch (e.type) {
      case 'number':
      case 'text':
      case 'bool':
        return e.value;
      case 'var':
        return vars.get(e.name) ?? 0;
      case 'arith': {
        const a = num(evaluate(e.a));
        const b = num(evaluate(e.b));
        if (e.op === '+') return a + b;
        if (e.op === '-') return a - b;
        if (e.op === '*') return a * b;
        if (b === 0) throw new RunError('divide_by_zero');
        return a / b;
      }
      case 'compare': {
        const a = evaluate(e.a);
        const b = evaluate(e.b);
        switch (e.op) {
          case 'eq':
            return a === b;
          case 'neq':
            return a !== b;
          case 'lt':
            return a < b;
          case 'lte':
            return a <= b;
          case 'gt':
            return a > b;
          case 'gte':
            return a >= b;
        }
        break;
      }
      case 'logic':
        return e.op === 'and'
          ? truthy(evaluate(e.a)) && truthy(evaluate(e.b))
          : truthy(evaluate(e.a)) || truthy(evaluate(e.b));
      case 'not':
        return !truthy(evaluate(e.a));
      case 'random':
        return random(num(evaluate(e.from)), num(evaluate(e.to)));
      case 'button_pressed':
        return device.isPressed(e.button);
      case 'light_level':
        return device.lightLevel();
      case 'acceleration':
        return device.acceleration(e.axis);
      case 'temperature':
        return device.temperature();
    }
    return 0;
  };

  const text = (v: Value): string =>
    typeof v === 'boolean' ? (v ? 'True' : 'False') : typeof v === 'number' ? formatNumber(v) : v;

  const exec = async (list: Stmt[]): Promise<void> => {
    for (const s of list) {
      await check();
      switch (s.type) {
        case 'show_icon':
          device.show(s.icon);
          break;
        case 'show_number':
          await device.scroll(formatNumber(num(evaluate(s.value))));
          break;
        case 'show_text':
          await device.scroll(text(evaluate(s.value)));
          break;
        case 'clear':
          device.clear();
          break;
        case 'pause':
          await sleep(num(evaluate(s.ms)));
          break;
        case 'repeat': {
          const times = Math.trunc(num(evaluate(s.times)));
          for (let i = 0; i < times; i += 1) {
            await check();
            await exec(s.body);
          }
          break;
        }
        case 'while':
          while (truthy(evaluate(s.cond))) {
            await check();
            await exec(s.body);
          }
          break;
        case 'if':
          await exec(truthy(evaluate(s.cond)) ? s.then : s.else);
          break;
        case 'set':
          vars.set(s.name, evaluate(s.value));
          break;
        case 'change':
          vars.set(s.name, num(vars.get(s.name) ?? 0) + num(evaluate(s.by)));
          break;
        case 'digital_write':
          device.writeDigital(s.pin, s.value);
          break;
        case 'motor': {
          const [a, b] = s.action === 'forward' ? [1, 0] : s.action === 'reverse' ? [0, 1] : [0, 0];
          device.writeDigital(0, a as 0 | 1);
          device.writeDigital(1, b as 0 | 1);
          break;
        }
      }
    }
  };

  const of = <T extends Handler['type']>(type: T) =>
    program.handlers.filter((h): h is Extract<Handler, { type: T }> => h.type === type);

  for (const h of of('on_start')) await exec(h.body);
  const forevers = of('forever');
  const buttons = of('on_button');
  if (!forevers.length && !buttons.length) return;
  for (;;) {
    for (const h of forevers) await exec(h.body);
    for (const h of buttons) {
      if (device.wasPressed(h.button)) await exec(h.body);
    }
    await sleep(20);
  }
}
