// Program files learners can save and open (M3 spec FR-9). Files from elsewhere are untrusted:
// size-limited, parsed safely and validated before anything is loaded (spec §8).
import { parseProgram, type Program } from '../../../../packages/blocks/src/index';

export const FILE_FORMAT = 'robot-for-all-program';
export const FILE_EXTENSION = '.rfa.json';
export const MAX_FILE_BYTES = 100_000;

export const MAX_PYTHON_CHARS = 50_000;

/** A program file. `python` is set when the learner switched to typing Python. */
export interface ProgramFile {
  name: string;
  program: Program;
  python?: string;
}

export function toFile(name: string, program: Program, python?: string): string {
  const file = { format: FILE_FORMAT, version: 1, name, program, ...(python === undefined ? {} : { python }) };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Reads a program file; throws if it isn't one of ours or isn't valid. */
export function fromFile(text: string): ProgramFile {
  if (text.length > MAX_FILE_BYTES) throw new Error('too big');
  const data: unknown = JSON.parse(text);
  if (typeof data !== 'object' || data === null) throw new Error('not a program');
  const file = data as Record<string, unknown>;
  if (file['format'] !== FILE_FORMAT || file['version'] !== 1) throw new Error('not a program');
  const name = typeof file['name'] === 'string' ? file['name'].slice(0, 60) : '';
  const python = file['python'];
  if (python !== undefined && (typeof python !== 'string' || python.length > MAX_PYTHON_CHARS)) {
    throw new Error('bad python');
  }
  return { name, program: parseProgram(file['program']), ...(python === undefined ? {} : { python }) };
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
