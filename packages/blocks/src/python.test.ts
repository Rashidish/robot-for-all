import { describe, expect, it } from 'vitest';
import { pythonNames, pythonString, toPython } from './python';
import { SAMPLES } from './samples';
import type { Program } from './program';

describe('MicroPython generator', () => {
  it('writes readable MicroPython for the blinking heart', () => {
    expect(toPython(SAMPLES.blinkHeart)).toBe(
      [
        '# Made with the Robot For All block editor',
        'from microbit import *',
        '',
        'while True:',
        '    # forever',
        '    display.show(Image.HEART)',
        '    sleep(500)',
        '    display.clear()',
        '    sleep(500)',
        '    sleep(20)',
        ''
      ].join('\n')
    );
  });

  it('polls buttons in the main loop', () => {
    const py = toPython(SAMPLES.buttonFaces);
    expect(py).toContain('# on start\ndisplay.show(Image.ASLEEP)');
    expect(py).toContain('    if button_a.was_pressed():\n        display.show(Image.HAPPY)');
    expect(py).toContain('    if button_b.was_pressed():\n        display.show(Image.SAD)');
  });

  it('drives the motor with robot calls, not pins (ADR-0008)', () => {
    const py = toPython(SAMPLES.goAndStop);
    expect(py).toContain('import rfa_robot\n');
    expect(py).toContain('rfa_robot.motor("left", 100)');
    expect(py).not.toMatch(/\bpin\d/);
  });

  it('is the same every time for the same program', () => {
    expect(toPython(SAMPLES.countdown)).toBe(toPython(SAMPLES.countdown));
  });

  it('writes empty blocks as pass', () => {
    const p: Program = { version: 1, handlers: [{ type: 'forever', body: [] }] };
    expect(toPython(p)).toContain('    # forever\n    pass');
  });
});

describe('safe Python names and strings', () => {
  it('turns learner variable names into unique Python names', () => {
    const names = pythonNames(['my score', 'my_score', 'display', '2fast', 'ṡpeed', 'if']);
    expect([...names.values()]).toEqual([
      'my_score',
      'my_score_2',
      'v_display',
      'v_2fast',
      'peed',
      'v_if'
    ]);
  });

  it("never lets a learner's text break out of its string", () => {
    expect(pythonString('Hi "there"\\')).toBe('"Hi \\"there\\"\\\\"');
    expect(pythonString('a\nb\u0000')).toBe('"a\\nb\\x00"');
    expect(pythonString('Sawubona ✓')).toBe('"Sawubona ✓"');
  });
});
