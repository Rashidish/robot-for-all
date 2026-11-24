import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GitHub } from './github';
import { makeLanguageKind, onlyLanguageStatusChanged } from './language-review';
import { mergeIfReady } from './merge';

const list = readFileSync(
  join(import.meta.dirname, '../../../../content/i18n/languages.json'),
  'utf8'
);
const zu = makeLanguageKind('zu');

describe('reviewing a language', () => {
  it('reads isiZulu as a draft with no build test', () => {
    expect(zu.summarise('zu', list)).toEqual({
      id: 'zu',
      title: 'isiZulu',
      status: 'draft',
      reviewedBy: null,
      buildTestedBy: 'n/a'
    });
  });

  it('approving publishes only isiZulu, formatted as the repository keeps it', () => {
    const after = zu.withStatus(list, zu.after(zu.summarise('zu', list), 'approved', 'N. Dlamini'));
    expect(onlyLanguageStatusChanged(list, after)).toBe(true);
    const zuEntry = (
      JSON.parse(after) as { languages: { code: string; status: string; reviewed_by: string }[] }
    ).languages.find((l) => l.code === 'zu');
    expect(zuEntry).toMatchObject({ status: 'published', reviewed_by: 'N. Dlamini' });
  });

  it('the merge check refuses anything else in the language list', () => {
    const renamed = list.replace('"native": "isiZulu"', '"native": "IsiZulu"');
    expect(onlyLanguageStatusChanged(list, renamed)).toBe(false);
    expect(onlyLanguageStatusChanged(list, list)).toBe(false);
    const both = list
      .replaceAll('"status": "draft"', '"status": "in_review"')
      .replace('"status": "published"', '"status": "draft"');
    expect(onlyLanguageStatusChanged(list, both)).toBe(false);
    expect(onlyLanguageStatusChanged(list, '{ broken')).toBe(false);
  });

  it('merges a status-only language change after CI and a recorded decision', async () => {
    const after = zu.withStatus(list, { status: 'in_review' });
    const merged: string[] = [];
    const gh = {
      getPull: async () => ({
        number: 5,
        html_url: 'https://github.com/x/y/pull/5',
        title: 't',
        state: 'open',
        user: { login: 'app[bot]' },
        head: { ref: 'admin/language-zu-20261124-150000', sha: 'h' },
        base: { ref: 'main' }
      }),
      pullFiles: async () => [{ filename: 'content/i18n/languages.json', status: 'modified' }],
      readFile: async (_p: string, ref: string) => ({
        text: ref === 'main' ? list : after,
        sha: ref
      }),
      checks: async () => 'passed',
      merge: async (_n: number, sha: string) => void merged.push(sha)
    } as unknown as GitHub;
    expect(
      (await mergeIfReady(gh, 5, { appLogin: 'app[bot]', decided: async () => true })).ok
    ).toBe(true);
    expect(merged).toEqual(['h']);
  });
});
