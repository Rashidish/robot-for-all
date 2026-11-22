import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildHex, readMainPy, type Firmware } from './hex';

const firmware: Firmware = {
  v1: readFileSync(
    new URL('../../public/firmware/microbit-v1-micropython-1.1.1.hex', import.meta.url),
    'utf8'
  ),
  v2: readFileSync(
    new URL('../../public/firmware/microbit-v2-micropython-2.1.2.hex', import.meta.url),
    'utf8'
  )
};

const program =
  'from microbit import *\n\nwhile True:\n    display.show(Image.HEART)\n    sleep(500)\n';

describe('micro:bit hex builder', () => {
  it('builds a universal hex for V1 and V2', () => {
    const hex = buildHex(program, firmware);
    expect(hex.startsWith(':')).toBe(true);
    // Universal hex files mark each board section with a block-start record (type 0x0A).
    expect(hex).toMatch(/^:0400000A/m);
    expect(hex.length).toBeGreaterThan(firmware.v2.length);
  });

  it('puts main.py into the hex so it can be read back', () => {
    const hex = buildHex(program, firmware);
    expect(readMainPy(hex, firmware)).toBe(program);
  });

  it('keeps non-English text intact', () => {
    const text = 'from microbit import *\ndisplay.scroll("Sawubona!")\n';
    expect(readMainPy(buildHex(text, firmware), firmware)).toBe(text);
  });
});
