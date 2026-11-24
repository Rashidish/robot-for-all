// Content → Languages (more content spec §2.5): list the site's languages with how complete each
// is, add one (draft) and remove one. Adding or removing changes three files (the language list,
// the language's interface file and the translation compiler's settings), so these pull requests
// are merged by a person on GitHub, not by the back office.
import {
  checkLanguages,
  completeness,
  type Language,
  type LanguageList,
  SA_LANGUAGES
} from '../../../../packages/settings/src/languages';
import { buildWithdrawn, isWithdrawn } from '../../../../packages/settings/src/withdrawn';
import { prettyJson } from '../../../../packages/settings/src/json';
import type { GitHub } from './github';

export const LANGUAGES_PATH = 'content/i18n/languages.json';
export const INLANG_PATH = 'project.inlang/settings.json';
const messagesPath = (code: string) => `content/i18n/${code}.json`;
const json = prettyJson;

export interface LanguageRow extends Language {
  translated: number;
  total: number;
  withdrawn: boolean;
}

export async function readLanguages(
  gh: GitHub
): Promise<{ rows: LanguageRow[]; offer: typeof SA_LANGUAGES }> {
  const [listFile, enFile, withdrawnFile] = await Promise.all([
    gh.readFile(LANGUAGES_PATH),
    gh.readFile(messagesPath('en')),
    gh.readFile('content/site/withdrawn.json')
  ]);
  const list = JSON.parse(listFile.text) as LanguageList;
  const en = JSON.parse(enFile.text) as Record<string, string>;
  const withdrawn = buildWithdrawn(JSON.parse(withdrawnFile.text));
  const rows = await Promise.all(
    list.languages.map(async (l) => {
      const words =
        l.code === 'en'
          ? en
          : (JSON.parse((await gh.readFile(messagesPath(l.code))).text) as Record<string, string>);
      const c = completeness(en, words);
      return {
        ...l,
        translated: c.translated,
        total: c.total,
        withdrawn: isWithdrawn(withdrawn, 'language', l.code)
      };
    })
  );
  const have = new Set(list.languages.map((l) => l.code));
  return { rows, offer: SA_LANGUAGES.filter((l) => !have.has(l.code)) };
}

/** The three files after adding a language as a draft; throws on a bad or duplicate language. */
export function filesForAdd(
  list: LanguageList,
  inlang: { locales: string[] } & Record<string, unknown>,
  lang: { code: string; name: string; native: string }
): { list: LanguageList; inlang: typeof inlang; messages: string } {
  const code = lang.code.trim().toLowerCase();
  if (list.languages.some((l) => l.code === code))
    throw new Error(`${code} is already a language of the site.`);
  const next: LanguageList = {
    languages: [
      ...list.languages,
      {
        code,
        name: lang.name.trim(),
        native: lang.native.trim(),
        status: 'draft',
        reviewed_by: null
      }
    ]
  };
  const nextInlang = { ...inlang, locales: [...inlang.locales, code] };
  const problems = checkLanguages(
    next,
    new Set([...list.languages.map((l) => l.code), code]),
    nextInlang.locales
  );
  if (problems.length > 0) throw new Error(problems.map((p) => p.message).join('; '));
  return { list: next, inlang: nextInlang, messages: '{}\n' };
}

/** The language list and compiler settings after removing a language; English can't be removed. */
export function filesForRemove(
  list: LanguageList,
  inlang: { locales: string[] } & Record<string, unknown>,
  code: string,
  withdrawn: boolean
): { list: LanguageList; inlang: typeof inlang } {
  const lang = list.languages.find((l) => l.code === code);
  if (!lang) throw new Error(`${code} is not a language of the site.`);
  if (lang.source || code === 'en')
    throw new Error('English is the source language and can’t be removed.');
  if (lang.status === 'published' && !withdrawn)
    throw new Error(
      `${lang.name} is live: withdraw it first (Content → Withdrawn), then remove it.`
    );
  return {
    list: { languages: list.languages.filter((l) => l.code !== code) },
    inlang: { ...inlang, locales: inlang.locales.filter((c) => c !== code) }
  };
}

export async function addLanguage(
  gh: GitHub,
  lang: { code: string; name: string; native: string },
  who: string,
  now = new Date()
): Promise<string> {
  const [listFile, inlangFile] = await Promise.all([
    gh.readFile(LANGUAGES_PATH),
    gh.readFile(INLANG_PATH)
  ]);
  const next = filesForAdd(
    JSON.parse(listFile.text) as LanguageList,
    JSON.parse(inlangFile.text),
    lang
  );
  const code = lang.code.trim().toLowerCase();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return gh.proposeChanges({
    branch: `admin/language-add-${code}-${stamp}`,
    files: [
      { path: LANGUAGES_PATH, text: json(next.list), sha: listFile.sha },
      { path: INLANG_PATH, text: json(next.inlang), sha: inlangFile.sha },
      { path: messagesPath(code), text: next.messages }
    ],
    message: `Add ${lang.name} (${code}) as a draft language (back office)`,
    title: `Add ${lang.name} (${code}) as a draft language`,
    body: `Added in the back office by ${who}.\n\nA draft language is never offered to learners on the live site; missing words fall back to English. Merge on GitHub after CI passes.`
  });
}

export async function removeLanguage(
  gh: GitHub,
  code: string,
  withdrawn: boolean,
  who: string,
  now = new Date()
): Promise<string> {
  const [listFile, inlangFile, messages] = await Promise.all([
    gh.readFile(LANGUAGES_PATH),
    gh.readFile(INLANG_PATH),
    gh.readFile(messagesPath(code))
  ]);
  const list = JSON.parse(listFile.text) as LanguageList;
  const next = filesForRemove(list, JSON.parse(inlangFile.text), code, withdrawn);
  const name = list.languages.find((l) => l.code === code)?.name ?? code;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return gh.proposeChanges({
    branch: `admin/language-remove-${code}-${stamp}`,
    files: [
      { path: LANGUAGES_PATH, text: json(next.list), sha: listFile.sha },
      { path: INLANG_PATH, text: json(next.inlang), sha: inlangFile.sha },
      { path: messagesPath(code), sha: messages.sha, remove: true }
    ],
    message: `Remove ${name} (${code}) (back office)`,
    title: `Remove ${name} (${code})`,
    body: `Removed in the back office by ${who}. Its translations stay in Git history and can be restored. Merge on GitHub after CI passes.`
  });
}
