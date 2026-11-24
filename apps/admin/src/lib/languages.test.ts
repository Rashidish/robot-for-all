import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LanguageList } from '../../../../packages/settings/src/languages';
import type { GitHub } from './github';
import { addLanguage, filesForAdd, filesForRemove, removeLanguage } from './languages';

const root = join(import.meta.dirname, '../../../../');
const list = JSON.parse(
  readFileSync(join(root, 'content/i18n/languages.json'), 'utf8')
) as LanguageList;
const inlang = JSON.parse(readFileSync(join(root, 'project.inlang/settings.json'), 'utf8')) as {
  locales: string[];
};
const zu = { code: 'zu', name: 'isiZulu', native: 'isiZulu' };

describe('Content → Languages', () => {
  it('adding isiZulu: a draft entry, the compiler locale and an empty interface file', () => {
    const next = filesForAdd(list, inlang, zu);
    expect(next.list.languages.at(-1)).toEqual({ ...zu, status: 'draft', reviewed_by: null });
    expect(next.inlang.locales).toEqual(['en', 'zu']);
    expect(next.messages).toBe('{}\n');
    expect(() => filesForAdd(next.list, next.inlang, zu)).toThrow(/already/);
    expect(() => filesForAdd(list, inlang, { ...zu, code: 'Zulu' })).toThrow();
  });

  it('removing: English never; a live language only after it is withdrawn', () => {
    const added = filesForAdd(list, inlang, zu);
    expect(() => filesForRemove(added.list, added.inlang, 'en', false)).toThrow(/source/);
    const live: LanguageList = {
      languages: added.list.languages.map((l) =>
        l.code === 'zu' ? { ...l, status: 'published', reviewed_by: 'R' } : l
      )
    };
    expect(() => filesForRemove(live, added.inlang, 'zu', false)).toThrow(/withdraw it first/);
    expect(filesForRemove(live, added.inlang, 'zu', true).inlang.locales).toEqual(['en']);
    expect(filesForRemove(added.list, added.inlang, 'zu', false).list).toEqual(list);
  });

  it('add and remove are each one pull request with all three files', async () => {
    const calls: { files: { path: string; remove?: boolean }[]; branch: string }[] = [];
    const files: Record<string, string> = {
      'content/i18n/languages.json': JSON.stringify(filesForAdd(list, inlang, zu).list),
      'project.inlang/settings.json': JSON.stringify(filesForAdd(list, inlang, zu).inlang),
      'content/i18n/zu.json': '{}'
    };
    const gh = {
      readFile: async (p: string) => ({ text: files[p] ?? '', sha: `sha-${p}` }),
      proposeChanges: async (c: {
        files: { path: string; remove?: boolean }[];
        branch: string;
      }) => {
        calls.push(c);
        return 'https://github.com/x/y/pull/1';
      }
    } as unknown as GitHub;
    await removeLanguage(gh, 'zu', false, 'Owner', new Date('2026-11-24T15:00:00Z'));
    expect(calls[0]?.branch).toBe('admin/language-remove-zu-20261124-150000');
    expect(calls[0]?.files.map((f) => [f.path, Boolean(f.remove)])).toEqual([
      ['content/i18n/languages.json', false],
      ['project.inlang/settings.json', false],
      ['content/i18n/zu.json', true]
    ]);
    files['content/i18n/languages.json'] = JSON.stringify(list);
    files['project.inlang/settings.json'] = JSON.stringify(inlang);
    await addLanguage(gh, zu, 'Owner', new Date('2026-11-24T15:00:00Z'));
    expect(calls[1]?.files.map((f) => f.path)).toEqual([
      'content/i18n/languages.json',
      'project.inlang/settings.json',
      'content/i18n/zu.json'
    ]);
  });
});
