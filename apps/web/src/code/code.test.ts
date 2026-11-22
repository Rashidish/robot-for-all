import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../../../../packages/blocks/src/index';
import { fileName, fromFile, MAX_FILE_BYTES, toFile } from './files';
import { listPrograms, loadStore, saveStore, STORAGE_KEY } from './storage';

describe('program files', () => {
  it('save and open again unchanged', () => {
    const file = toFile('Blink', SAMPLES.blinkHeart);
    expect(fromFile(file)).toEqual({ name: 'Blink', program: SAMPLES.blinkHeart });
  });

  it('refuse other files, invalid programs and very large files', () => {
    expect(() => fromFile('{"hello": 1}')).toThrow();
    expect(() => fromFile('not json')).toThrow();
    expect(() =>
      fromFile(
        JSON.stringify({
          format: 'robot-for-all-program',
          version: 1,
          program: { version: 1, handlers: [{ type: 'hack' }] }
        })
      )
    ).toThrow();
    expect(() => fromFile(' '.repeat(MAX_FILE_BYTES + 1))).toThrow('too big');
  });

  it('keep typed Python, and refuse Python that is too long', () => {
    const file = toFile('Typed', SAMPLES.blinkHeart, 'from microbit import *\n');
    expect(fromFile(file).python).toBe('from microbit import *\n');
    const huge = JSON.stringify({
      format: 'robot-for-all-program',
      version: 1,
      program: SAMPLES.blinkHeart,
      python: 'x'.repeat(50_001)
    });
    expect(() => fromFile(huge)).toThrow();
  });

  it('make safe file names', () => {
    expect(fileName('My robot: go/stop!')).toBe('My-robot-gostop');
    expect(fileName('???')).toBe('program');
  });
});

describe('my programs', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v)
    };
  };

  it('saves and loads programs, newest first', () => {
    const storage = memory();
    const store = {
      current: 'b',
      programs: {
        a: { id: 'a', name: 'Old', updated: 1, workspace: {} },
        b: { id: 'b', name: 'New', updated: 2, workspace: {} }
      }
    };
    expect(saveStore(storage, store)).toBe(true);
    const loaded = loadStore(storage);
    expect(loaded.current).toBe('b');
    expect(listPrograms(loaded).map((p) => p.name)).toEqual(['New', 'Old']);
  });

  it('treats broken or blocked storage as empty', () => {
    expect(loadStore({ getItem: () => '{broken' })).toEqual({ current: null, programs: {} });
    expect(
      loadStore({
        getItem: () => {
          throw new Error('blocked');
        }
      })
    ).toEqual({ current: null, programs: {} });
    expect(
      saveStore(
        {
          setItem: () => {
            throw new Error('full');
          }
        },
        { current: null, programs: {} }
      )
    ).toBe(false);
    expect(STORAGE_KEY).toBe('rfa-code-v1');
  });
});
