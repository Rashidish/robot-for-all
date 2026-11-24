// Reviewing a language (more content spec §2.3): its status lives in its entry of
// content/i18n/languages.json. A decision changes only that entry's status and reviewed_by; the
// merge check (ADR-0012) accepts exactly that. Approving needs every interface word translated.
import { prettyJson } from '../../../../packages/settings/src/json';
import type { Language, LanguageList } from '../../../../packages/settings/src/languages';
import type { ContentKind, Item } from './kinds';
import { LANGUAGES_PATH } from './languages';

export const LANGUAGE_CHECKLIST: { key: string; label: string }[] = [
  { key: 'meaning_kept', label: 'The meaning is kept everywhere (not word for word)' },
  {
    key: 'safety_exact',
    label: 'Safety words are exact (adult help, batteries, sharp tools, never mains)'
  },
  { key: 'child_words', label: 'Words a child in Grades 3–7 knows' },
  {
    key: 'local_terms',
    label: 'Names of parts and tools as used locally (agreed loan words where needed)'
  },
  { key: 'no_english_left', label: 'Nothing is left in English by mistake' }
];

export type LanguageItem = Item;

const entryOf = (text: string, code: string): Language | undefined =>
  (JSON.parse(text) as LanguageList).languages.find((l) => l.code === code);

export function makeLanguageKind(code: string): ContentKind<LanguageItem> {
  return {
    type: 'language',
    noun: 'language',
    path: () => LANGUAGES_PATH,
    list: { folder: 'content/i18n', entries: 'json-files' },
    summarise: (id, text) => {
      const l = entryOf(text, id);
      if (!l) throw new Error(`${id} is not a language of the site.`);
      // A language has no build test: "n/a" keeps that decision off the page.
      return {
        id,
        title: l.name,
        status: l.status,
        reviewedBy: l.reviewed_by,
        buildTestedBy: 'n/a'
      };
    },
    withStatus: (text, change) => {
      const list = JSON.parse(text) as LanguageList;
      return prettyJson({
        languages: list.languages.map((l) =>
          l.code !== code
            ? l
            : {
                ...l,
                ...(change.status !== undefined ? { status: change.status } : {}),
                ...(change.reviewedBy !== undefined ? { reviewed_by: change.reviewedBy } : {})
              }
        )
      });
    },
    onlyStatusChanged: onlyLanguageStatusChanged,
    after: (_l, decision, name) => {
      switch (decision) {
        case 'sent_for_review':
          return { status: 'in_review' };
        case 'approved':
          return { status: 'published', reviewedBy: name };
        case 'changes_requested':
        case 'unpublished':
          return { status: 'draft', reviewedBy: null };
        case 'build_tested':
          return {};
      }
    },
    checklist: LANGUAGE_CHECKLIST
  };
}

/**
 * True when two versions of the language list differ only in one language's status and
 * reviewed_by (ADR-0012 condition 2), and the text is formatted as the repository keeps it.
 */
export function onlyLanguageStatusChanged(before: string, after: string): boolean {
  try {
    const a = (JSON.parse(before) as LanguageList).languages;
    const b = (JSON.parse(after) as LanguageList).languages;
    if (a.length !== b.length || prettyJson(JSON.parse(after)) !== after) return false;
    const strip = (l: Language) =>
      JSON.stringify({ ...l, status: undefined, reviewed_by: undefined });
    let changed = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      if (!x || !y || strip(x) !== strip(y)) return false;
      if (x.status !== y.status || x.reviewed_by !== y.reviewed_by) changed++;
    }
    return changed === 1;
  } catch {
    return false;
  }
}
