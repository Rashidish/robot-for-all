import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLanguages, completeness } from './languages';

const root = join(import.meta.dirname, '../../..');
const list = JSON.parse(readFileSync(join(root, 'content/i18n/languages.json'), 'utf8')) as unknown;
const files = new Set(
  readdirSync(join(root, 'content/i18n'))
    .filter((f) => /^[a-z]{2,3}\.json$/.test(f))
    .map((f) => f.replace('.json', ''))
);
const compiled = (
  JSON.parse(readFileSync(join(root, 'project.inlang/settings.json'), 'utf8')) as {
    locales: string[];
  }
).locales;
const en = {
  code: 'en',
  name: 'English',
  native: 'English',
  status: 'published',
  source: true,
  reviewed_by: null
};
const zu = { code: 'zu', name: 'isiZulu', native: 'isiZulu', status: 'draft', reviewed_by: null };

describe('languages (more content spec §2.5)', () => {
  it('the list in the repository matches the interface files and the compiler', () => {
    expect(checkLanguages(list, files, compiled)).toEqual([]);
  });

  it('accepts a draft isiZulu with its file and compiler entry', () => {
    expect(checkLanguages({ languages: [en, zu] }, new Set(['en', 'zu']), ['en', 'zu'])).toEqual(
      []
    );
  });

  it.each([
    ['no English', { languages: [zu] }, ['en', 'zu'], 'English'],
    [
      'English not the published source',
      { languages: [{ ...en, status: 'draft' }] },
      ['en'],
      'source'
    ],
    [
      'a published language without a reviewer',
      { languages: [en, { ...zu, status: 'published' }] },
      ['en', 'zu'],
      'reviewer who reads it'
    ],
    ['a language without its file', { languages: [en, zu] }, ['en', 'zu'], 'zu.json is missing'],
    ['the compiler not set up for it', { languages: [en, zu] }, ['en'], 'project.inlang'],
    ['a bad code', { languages: [en, { ...zu, code: 'Zulu' }] }, ['en'], 'language code'],
    ['twice the same code', { languages: [en, zu, zu] }, ['en', 'zu'], 'twice']
  ])('refuses %s', (_name, spec, comp, message) => {
    const withFile =
      _name === 'a language without its file' ? new Set(['en']) : new Set(['en', 'zu']);
    expect(
      checkLanguages(spec, withFile, comp)
        .map((p) => p.message)
        .join(' | ')
    ).toContain(message);
  });

  it('counts the interface words a language has', () => {
    expect(completeness({ a: 'Home', b: 'Lessons', c: 'Run' }, { a: 'Ikhaya', b: ' ' })).toEqual({
      translated: 1,
      total: 3,
      missing: ['b', 'c']
    });
  });
});
