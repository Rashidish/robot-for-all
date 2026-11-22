// The virtual micro:bit and the real one must do the same thing (M3 spec §9): each sample is
// turned into MicroPython and run against a stub "microbit" module in Python, and also run in the
// interpreter. Both record LED, scroll, pin and pause actions; the two lists must match.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { run, Stopped, type Clock, type Device } from './interpreter';
import { toPython } from './python';
import { SAMPLES } from './samples';
import type { Program } from './program';

interface Scenario {
  limit_ms?: number;
  light?: number;
  presses?: Partial<Record<'A' | 'B', number[]>>;
}

type Trace = (string | number)[][];

function runPython(program: Program, scenario: Scenario): { trace: Trace; error: string | null } {
  const script = fileURLToPath(new URL('../test-support/run_stub.py', import.meta.url));
  const result = spawnSync('python3', [script], {
    input: toPython(program),
    env: { ...process.env, MICROBIT_SCENARIO: JSON.stringify(scenario) },
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`Python failed:\n${result.stderr}`);
  return JSON.parse(result.stdout) as { trace: Trace; error: string | null };
}

async function runInterpreter(program: Program, scenario: Scenario): Promise<Trace> {
  const trace: Trace = [];
  let time = 0;
  const limit = scenario.limit_ms ?? 3000;
  const seen = { A: 0, B: 0 };
  const presses = (b: 'A' | 'B') => (scenario.presses?.[b] ?? []).filter((t) => t <= time);
  const clock: Clock = {
    sleep: async (ms) => {
      trace.push(['sleep', ms]);
      time += ms;
      if (time > limit) throw new Stopped();
    },
    breathe: async () => undefined
  };
  const device: Device = {
    show: (icon) => void trace.push(['show', icon]),
    scroll: async (text) => void trace.push(['scroll', text]),
    clear: () => void trace.push(['clear']),
    writeDigital: (pin, value) => void trace.push(['pin', pin, value]),
    isPressed: (b) => (scenario.presses?.[b] ?? []).some((t) => t <= time && time < t + 100),
    wasPressed: (b) => {
      const count = presses(b).length;
      const pressed = count > seen[b];
      seen[b] = count;
      return pressed;
    },
    lightLevel: () => scenario.light ?? 128,
    acceleration: (axis) => (axis === 'z' ? -1024 : 0),
    temperature: () => 21
  };
  try {
    await run(program, device, clock);
  } catch (err) {
    if (!(err instanceof Stopped)) throw err;
  }
  return trace;
}

const cases: [string, Program, Scenario][] = [
  ['blinking heart', SAMPLES.blinkHeart, { limit_ms: 2100 }],
  ['button faces', SAMPLES.buttonFaces, { limit_ms: 600, presses: { A: [100], B: [300, 320] } }],
  ['night light in the dark', SAMPLES.nightLight, { limit_ms: 400, light: 10 }],
  ['night light in daylight', SAMPLES.nightLight, { limit_ms: 400, light: 200 }],
  ['go and stop', SAMPLES.goAndStop, { limit_ms: 3000, presses: { A: [40], B: [1500] } }],
  ['countdown, text and loops', SAMPLES.countdown, {}]
];

describe('interpreter and MicroPython agree', () => {
  for (const [name, program, scenario] of cases) {
    it(name, async () => {
      const python = runPython(program, scenario);
      expect(python.error).toBeNull();
      expect(python.trace.length).toBeGreaterThan(0);
      expect(await runInterpreter(program, scenario)).toEqual(python.trace);
    });
  }

  it('both stop with the same error when dividing by zero', async () => {
    const program: Program = {
      version: 1,
      handlers: [
        {
          type: 'on_start',
          body: [
            {
              type: 'show_number',
              value: { type: 'arith', op: '/', a: { type: 'number', value: 1 }, b: { type: 'number', value: 0 } }
            }
          ]
        }
      ]
    };
    expect(runPython(program, {}).error).toBe('divide_by_zero');
    await expect(runInterpreter(program, {})).rejects.toThrow('divide_by_zero');
  });

  it('can be stopped, even in a loop that never pauses', async () => {
    const program: Program = {
      version: 1,
      handlers: [{ type: 'on_start', body: [{ type: 'while', cond: { type: 'bool', value: true }, body: [] }] }]
    };
    const controller = new AbortController();
    let breaths = 0;
    const clock: Clock = {
      sleep: async () => undefined,
      breathe: async () => {
        breaths += 1;
        if (breaths === 3) controller.abort();
      }
    };
    const device = new Proxy({} as Device, { get: () => () => false });
    await expect(run(program, device, clock, { signal: controller.signal })).rejects.toBeInstanceOf(Stopped);
  });
});
