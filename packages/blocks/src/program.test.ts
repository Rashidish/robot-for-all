import { describe, expect, it } from 'vitest';
import { LIMITS, parseProgram, ProgramError, variableNames } from './program';
import { SAMPLES } from './samples';

describe('program validation', () => {
  it('accepts every sample program unchanged', () => {
    for (const sample of Object.values(SAMPLES)) {
      expect(parseProgram(JSON.parse(JSON.stringify(sample)))).toEqual(sample);
    }
  });

  it('rejects unknown blocks and fields, with the path to the problem', () => {
    expect(() => parseProgram({ version: 1, handlers: [{ type: 'forever', body: [{ type: 'explode' }] }] })).toThrow(
      /handlers\[0\]\.body\[0\]: unknown block "explode"/
    );
    expect(() =>
      parseProgram({ version: 1, handlers: [{ type: 'on_start', body: [{ type: 'clear', extra: 1 }] }] })
    ).toThrow(ProgramError);
    expect(() => parseProgram({ version: 2, handlers: [] })).toThrow(/unsupported version/);
    expect(() => parseProgram('not a program')).toThrow(ProgramError);
  });

  it('rejects bad values', () => {
    const withValue = (value: unknown) => ({
      version: 1,
      handlers: [{ type: 'on_start', body: [{ type: 'show_number', value }] }]
    });
    expect(() => parseProgram(withValue({ type: 'number', value: Infinity }))).toThrow(/number/);
    expect(() => parseProgram(withValue({ type: 'number', value: '5' }))).toThrow(/number/);
    expect(() => parseProgram(withValue({ type: 'text', value: 'x'.repeat(LIMITS.text + 1) }))).toThrow(/text/);
    expect(() => parseProgram(withValue({ type: 'var', name: 'a;import os' }))).toThrow(/variable names/);
    expect(() =>
      parseProgram({ version: 1, handlers: [{ type: 'on_start', body: [{ type: 'show_icon', icon: 'NOPE' }] }] })
    ).toThrow(/expected one of/);
  });

  it('refuses programs that are too big or nested too deeply', () => {
    const big = { version: 1, handlers: [{ type: 'on_start', body: Array(LIMITS.nodes + 1).fill({ type: 'clear' }) }] };
    expect(() => parseProgram(big)).toThrow(/too big/);
    let deep: unknown = { type: 'number', value: 1 };
    for (let i = 0; i < LIMITS.depth + 5; i += 1) deep = { type: 'not', a: deep };
    expect(() => parseProgram({ version: 1, handlers: [{ type: 'on_start', body: [{ type: 'show_number', value: deep }] }] })).toThrow(
      /nested too deeply/
    );
  });

  it('lists variables in first-use order', () => {
    expect(variableNames(SAMPLES.countdown)).toEqual(['count']);
    expect(variableNames(SAMPLES.blinkHeart)).toEqual([]);
  });
});
