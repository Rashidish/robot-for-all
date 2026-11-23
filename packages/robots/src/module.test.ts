// rfa_robot.py runs in real Python against a stub micro:bit, so we see exactly which pins it drives.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Fixes, MODULE_BUDGET_BYTES, rfaRobotPy } from './module';
import { buildProfile, type Profile } from './profile';

const basic = buildProfile(
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../content/robots/l9110s-basic.json'), 'utf8')
  )
);
type Step = [string, number, number];

function run(
  main: string,
  opts: { profile?: Profile; fixes?: Fixes; reads?: Record<number, number> } = {}
) {
  const dir = mkdtempSync(join(tmpdir(), 'rfa-robot-'));
  writeFileSync(join(dir, 'rfa_robot.py'), rfaRobotPy(opts.profile ?? basic, opts.fixes));
  const result = spawnSync('python3', [join(import.meta.dirname, '../test-support/run.py'), dir], {
    input: `import rfa_robot\nimport microbit\nmicrobit.TRACE.clear()\n${main}`,
    env: { ...process.env, MICROBIT_SCENARIO: JSON.stringify({ reads: opts.reads ?? {} }) },
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`Python failed:\n${result.stderr}`);
  return JSON.parse(result.stdout) as { trace: Step[]; results: unknown[] };
}

describe('rfa_robot.py on a pin-driven board (L9110S)', () => {
  it('drives a motor forward with speed on its forward pin', () => {
    expect(run('rfa_robot.motor("left", 60)').trace).toEqual([
      ['digital', 1, 0],
      ['analog', 0, 613]
    ]);
  });

  it('drives backward on the other pin, and clamps the speed', () => {
    expect(run('rfa_robot.motor("right", -250)').trace).toEqual([
      ['digital', 2, 0],
      ['analog', 8, 1023]
    ]);
  });

  it('stop turns every motor pin off', () => {
    expect(run('rfa_robot.stop()').trace).toEqual([
      ['digital', 1, 0],
      ['digital', 0, 0],
      ['digital', 8, 0],
      ['digital', 2, 0]
    ]);
  });

  it('reads whiskers and line sensors on their assigned pins', () => {
    const main = [
      'RESULTS.append(rfa_robot.whisker("left"))',
      'RESULTS.append(rfa_robot.whisker("right"))',
      'RESULTS.append(rfa_robot.line("left"))',
      'RESULTS.append(rfa_robot.line("right"))'
    ].join('\n');
    expect(run(main, { reads: { 12: 1, 14: 1 } }).results).toEqual([true, false, false, true]);
    expect(
      run(main, { reads: { 12: 1, 14: 1 }, fixes: { flipLineSensors: true } }).results
    ).toEqual([true, false, true, false]);
  });

  it('sets pull-down on the whisker pins, so an open switch reads 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rfa-robot-'));
    writeFileSync(join(dir, 'rfa_robot.py'), rfaRobotPy(basic));
    const r = spawnSync('python3', [join(import.meta.dirname, '../test-support/run.py'), dir], {
      input: 'import rfa_robot',
      encoding: 'utf8'
    });
    expect((JSON.parse(r.stdout) as { trace: Step[] }).trace).toEqual([
      ['pull', 12, 1],
      ['pull', 15, 1]
    ]);
  });

  it('lowers and lifts the pen servo', () => {
    expect(run('rfa_robot.pen(True)\nrfa_robot.pen(False)').trace).toEqual([
      ['period', 16, 20],
      ['analog', 16, 26],
      ['period', 16, 20],
      ['analog', 16, 77]
    ]);
  });

  it('"Test my robot" fixes: flip a motor, swap motors', () => {
    expect(run('rfa_robot.motor("left", 100)', { fixes: { flipLeft: true } }).trace).toEqual([
      ['digital', 0, 0],
      ['analog', 1, 1023]
    ]);
    expect(run('rfa_robot.motor("left", 100)', { fixes: { swapMotors: true } }).trace).toEqual([
      ['digital', 8, 0],
      ['analog', 2, 1023]
    ]);
  });

  it('on a one-motor board, right-motor calls do nothing', () => {
    const one = buildProfile({
      ...basic,
      motors: { method: 'pins', left: { forward: 0, backward: 1 }, right: null },
      usedPins: [0, 1]
    });
    expect(run('rfa_robot.motor("right", 100)', { profile: one }).trace).toEqual([]);
  });

  it('sensors without a free pin answer "no" and the pen does nothing', () => {
    const few = buildProfile({ ...basic, freePins: [13, 14] });
    const r = run('RESULTS.append(rfa_robot.whisker("left"))\nrfa_robot.pen(True)', {
      profile: few,
      reads: { 12: 1 }
    });
    expect(r).toEqual({ trace: [], results: [false] });
  });

  it('stays under 4 KB and imports only the pins it uses', () => {
    const py = rfaRobotPy(basic);
    expect(new TextEncoder().encode(py).length).toBeLessThan(MODULE_BUDGET_BYTES);
    expect(py).toContain(
      'from microbit import pin0, pin1, pin2, pin8, pin12, pin13, pin14, pin15, pin16\n'
    );
  });
});
