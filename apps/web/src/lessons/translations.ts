// Lesson translations (more content spec §2.7): content/lessons/<id>/index.<lang>.md.
// A translation holds only words; this file checks it against its English lesson when the site
// is built, and gives each page the lesson in its own language when one may be shown.
import { getCollection, type CollectionEntry } from 'astro:content';
import list from '../../../../content/i18n/languages.json';
import {
  headings,
  translationHash,
  translationProblems,
  translationView
} from '../../../../packages/settings/src/translation';
import type { LessonEntry } from './load';
import type { Lesson } from './schema';

export type TranslationEntry = CollectionEntry<'translations'>;

const englishFiles = import.meta.glob<string>('../../../../content/lessons/*/index.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

function englishFile(lesson: string): string | undefined {
  return Object.entries(englishFiles).find(([path]) => path.endsWith(`/${lesson}/index.md`))?.[1];
}

export interface CheckedTranslation {
  entry: TranslationEntry;
  lesson: string;
  lang: string;
  /** The English lesson changed after this was translated: it needs checking again. */
  stale: boolean;
}

let checked: Promise<CheckedTranslation[]> | undefined;

/**
 * Every translation, checked: its lesson exists, its language is on the language list, and its
 * words line up with the English lesson. A problem fails the build, like a broken lesson.
 */
export function getTranslations(lessons: readonly LessonEntry[]): Promise<CheckedTranslation[]> {
  checked ??= (async () => {
    const all = await getCollection('translations');
    const byId = new Map(lessons.map((l) => [l.id, l]));
    const codes = new Set(list.languages.map((l) => l.code).filter((c) => c !== 'en'));
    const problems: string[] = [];
    const out: CheckedTranslation[] = [];
    for (const entry of all) {
      const dot = entry.id.lastIndexOf('.');
      const lesson = entry.id.slice(0, dot);
      const lang = entry.id.slice(dot + 1);
      const where = `${lesson}/index.${lang}.md`;
      if (!codes.has(lang)) {
        problems.push(`${where}: "${lang}" is not a language in content/i18n/languages.json`);
        continue;
      }
      const english = byId.get(lesson);
      const file = englishFile(lesson);
      if (!file) {
        problems.push(`${where}: there is no English lesson content/lessons/${lesson}/index.md`);
        continue;
      }
      if (english) {
        for (const p of translationProblems(
          english.data,
          english.body ?? '',
          entry.data,
          entry.body ?? ''
        ))
          problems.push(`${where}: ${p}`);
      }
      const stale = entry.data.translated_from !== (await translationHash(file));
      out.push({ entry, lesson, lang, stale });
    }
    if (problems.length > 0) {
      throw new Error(`Translation problems:\n- ${problems.join('\n- ')}`);
    }
    return out;
  })();
  return checked;
}

/** Why a page in another language shows the English lesson, or a translation not yet live. */
export type LessonNotice = 'english' | 'draft' | 'stale' | null;

export interface LocalLesson {
  /** The lesson's data, with the translated words in place of the English ones. */
  data: Lesson;
  /** What to render: the translation, or the English lesson. */
  entry: LessonEntry | TranslationEntry;
  body: string;
  /** The language the lesson text is in (the page may be in another). */
  lang: string;
  /** The English `##` headings, by position: they name the PRIMM step of each section. */
  steps: string[];
  notice: LessonNotice;
}

/**
 * The lesson for a page in `lang`. Production shows a translation only when it is published and
 * up to date (the English lesson is already published, or the page wouldn't exist); otherwise
 * the English lesson, with a notice. The drafts preview shows every translation, with a notice.
 */
export async function localLesson(
  lesson: LessonEntry,
  lang: string,
  lessons: readonly LessonEntry[],
  showDrafts: boolean = __RFA_SHOW_DRAFTS__
): Promise<LocalLesson> {
  const steps = headings(lesson.body ?? '');
  const english: LocalLesson = {
    data: lesson.data,
    entry: lesson,
    body: lesson.body ?? '',
    lang: 'en',
    steps,
    notice: lang === 'en' ? null : 'english'
  };
  if (lang === 'en') return english;
  const t = (await getTranslations(lessons)).find((x) => x.lesson === lesson.id && x.lang === lang);
  if (!t) return english;
  const view = translationView(t.entry.data.status, t.stale, showDrafts);
  if (view === 'english') return english;
  const w = t.entry.data;
  return {
    data: {
      ...lesson.data,
      title: w.title,
      outcomes: w.outcomes,
      concepts: w.concepts,
      parts: lesson.data.parts.map((p, i) => ({
        ...p,
        item: w.parts[i]?.item ?? p.item,
        ...(p.substitute ? { substitute: w.parts[i]?.substitute ?? p.substitute } : {})
      })),
      safety: { ...lesson.data.safety, notes: w.safety_notes },
      assessment: w.assessment
    },
    entry: t.entry,
    body: t.entry.body ?? '',
    lang,
    steps,
    notice: view === 'live' ? null : view
  };
}

/** Lesson titles in `lang`, for links between lessons and the lesson list. */
export async function localTitles(
  lessons: readonly LessonEntry[],
  lang: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const l of lessons) out[l.id] = (await localLesson(l, lang, lessons)).data.title;
  return out;
}
