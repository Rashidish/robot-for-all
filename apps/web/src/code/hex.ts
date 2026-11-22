// Turns a MicroPython program into a .hex file for any micro:bit (M3 spec FR-7).
// Uses the micro:bit Foundation's microbit-fs (MIT) to put main.py into the MicroPython
// firmware's file system, for V1 and V2 together (a "universal hex").
import { MicropythonFsHex } from '@microbit/microbit-fs';
import { microbitBoardId } from '@microbit/microbit-universal-hex';

export interface Firmware {
  v1: string;
  v2: string;
}

/** Firmware files, served from our own domain (public/firmware/). */
export const FIRMWARE_URLS = {
  v1: '/firmware/microbit-v1-micropython-1.1.1.hex',
  v2: '/firmware/microbit-v2-micropython-2.1.2.hex'
} as const;

function fileSystem(firmware: Firmware): MicropythonFsHex {
  return new MicropythonFsHex([
    { hex: firmware.v1, boardId: microbitBoardId.V1 },
    { hex: firmware.v2, boardId: microbitBoardId.V2 }
  ]);
}

/** Builds a universal .hex containing `main.py`. */
export function buildHex(mainPy: string, firmware: Firmware): string {
  const fs = fileSystem(firmware);
  fs.write('main.py', mainPy);
  return fs.getUniversalHex();
}

/** Reads `main.py` back out of a .hex built by buildHex (used by tests and file import). */
export function readMainPy(hex: string, firmware: Firmware): string {
  const fs = fileSystem(firmware);
  fs.importFilesFromHex(hex, { overwrite: true });
  return fs.read('main.py');
}

/** Downloads both firmware files (cached by the service worker after the first time). */
export async function fetchFirmware(): Promise<Firmware> {
  const get = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firmware download failed: ${res.status}`);
    return res.text();
  };
  const [v1, v2] = await Promise.all([get(FIRMWARE_URLS.v1), get(FIRMWARE_URLS.v2)]);
  return { v1, v2 };
}
