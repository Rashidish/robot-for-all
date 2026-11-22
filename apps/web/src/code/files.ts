// Program files learners can save and open (M3 spec FR-9). Files from elsewhere are untrusted:
// size-limited, parsed safely and validated before anything is loaded (spec §8).
import { parseProgram, type Program } from '../../../../packages/blocks/src/index';

export const FILE_FORMAT = 'robot-for-all-program';
export const FILE_EXTENSION = '.rfa.json';
export const MAX_FILE_BYTES = 100_000;

export function toFile(name: string, program: Program): string {
  return `${JSON.stringify({ format: FILE_FORMAT, version: 1, name, program }, null, 2)}\n`;
}

/** Reads a program file; throws if it isn't one of ours or isn't valid. */
export function fromFile(text: string): { name: string; program: Program } {
  if (text.length > MAX_FILE_BYTES) throw new Error('too big');
  const data: unknown = JSON.parse(text);
  if (typeof data !== 'object' || data === null) throw new Error('not a program');
  const file = data as Record<string, unknown>;
  if (file['format'] !== FILE_FORMAT || file['version'] !== 1) throw new Error('not a program');
  const name = typeof file['name'] === 'string' ? file['name'].slice(0, 60) : '';
  return { name, program: parseProgram(file['program']) };
}

/** A safe file name from a program name. */
export function fileName(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return base || 'program';
}
