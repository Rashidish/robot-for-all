// FR-21 / ADR-0008: the simulator speaks robot calls only; no pin numbers in its code or interface.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Sim } from './sim';
import { buildWorld } from './world';

describe('no pins (FR-21)', () => {
  it('no source file names a pin', () => {
    const dir = import.meta.dirname;
    const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const f of sources) {
      const text = readFileSync(join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/\bpin_?\d*\b|\bP(0|1|2|8|1[2-6]|19|20)\b/i);
    }
  });

  it('the robot interface is motor, pen and sensor calls', () => {
    const sim = new Sim(
      buildWorld({
        id: 'x',
        version: 1,
        challenge: null,
        size: { w: 500, h: 500 },
        start: { x: 250, y: 250, heading: 0 }
      })
    );
    const calls = [
      'setMotor',
      'stopMotors',
      'setPen',
      'line',
      'whisker',
      'lightLevel',
      'wasShaken'
    ] as const;
    for (const c of calls) expect(typeof sim[c]).toBe('function');
  });
});
