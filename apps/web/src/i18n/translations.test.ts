import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translationProblems } from '../../../../packages/settings/src/languages';

const dir = join(import.meta.dirname, '../../../../content/i18n');
const read = (file: string) =>
  JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, string>;
const english = read('en.json');
const files = readdirSync(dir).filter((f) => /^[a-z]{2,3}\.json$/.test(f) && f !== 'en.json');

describe('translations keep every placeholder and block slot', () => {
  it.each(files)('%s', (file) => {
    expect(translationProblems(english, read(file))).toEqual([]);
  });

  it('catches a lost placeholder, a lost block slot and an unknown key', () => {
    expect(
      translationProblems(english, {
        lesson_phase: 'Isigaba',
        block_set: 'setha %1',
        made_up_key: 'x'
      })
    ).toHaveLength(3);
  });
});
