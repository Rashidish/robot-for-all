// Personal data out before every call (spec §7.1).
import { describe, expect, it } from 'vitest';
import { programForAi, strip } from './strip.ts';

describe('strip', () => {
  it('takes out emails, phone numbers, ID numbers and links', () => {
    const q = strip(
      'Email me at mom@example.org or call 082 555 1234 or +27825551234; ID 0101015800085; see https://example.com/x?y=1'
    );
    expect(q).not.toMatch(/mom@|555|0101015800085|example\.com/);
    expect(q).toContain('[email]');
    expect(q).toContain('[number]');
    expect(q).toContain('[link]');
  });

  it('takes out names after "my name is", "my child", isiZulu lead-ins, and where people live', () => {
    expect(strip('Hi, my name is Thandiwe Radebe and the gears slip')).toBe(
      'Hi, my name is [name] and the gears slip'
    );
    expect(strip('My child Sipho asks why the motor gets hot')).toBe(
      'My child [name] asks why the motor gets hot'
    );
    expect(strip('Igama lami ngu-Lerato, imoto ayihambi')).not.toContain('Lerato');
    expect(strip('I live at 12 Main Road, Soweto. The crank sticks.')).toBe(
      'I live at [place]. The crank sticks.'
    );
    // Lower-case words after a lead-in are not names and stay.
    expect(strip('my child wants to know about levers')).toBe(
      'my child wants to know about levers'
    );
  });

  it('replaces nicknames the asker can see, whole words in any case, each part of two-word ones', () => {
    expect(strip('thandi r and Rocket broke the jaw; Thandi cried', ['Thandi R', 'Rocket'])).toBe(
      'the learner and the learner broke the jaw; the learner cried'
    );
    // Not inside other words.
    expect(strip('the rocketship design', ['Rocket'])).toBe('the rocketship design');
  });
});

describe('programForAi', () => {
  it('keeps blocks, drops names and free text, and is size-capped', () => {
    const json = programForAi({
      format: 'robot-for-all-program',
      name: 'Thandi’s robot',
      blocks: [{ type: 'robot_forward', fields: { SPEED: 50 }, comment: 'by Thandi' }],
      notes: 'my secret'
    });
    expect(json).toBe(
      JSON.stringify({
        format: 'robot-for-all-program',
        blocks: [{ type: 'robot_forward', fields: { SPEED: 50 } }]
      })
    );
    expect(programForAi('nope')).toBeNull();
    expect(programForAi({ big: 'x'.repeat(30).repeat(1) }, 10)).toHaveLength(10);
  });
});
