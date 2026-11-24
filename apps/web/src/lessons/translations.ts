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
import type { SheetWords } from '../../../../packages/templates/src/index';
import { findTemplate } from '../templates/load';
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

const templateSources = import.meta.glob<string>('../../../../content/projects/*/templates/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default'
});

/** A lesson's template source files, which count towards `translated_from` (spec §2.4). */
function templateFiles(lesson: string): { name: string; text: string }[] {
  return Object.entries(templateSources)
    .filter(([path]) => path.includes(`/projects/${lesson}/templates/`))
    .map(([path, text]) => ({ name: path.split('/').pop() ?? path, text }));
}

/** Problems with a translation's template words: each sheet and part must exist in English. */
function sheetProblems(
  lesson: LessonEntry,
  templates: Record<string, { title?: string | undefined; parts: SheetWords['parts'] }>
): string[] {
  const problems: string[] = [];
  for (const [name, words] of Object.entries(templates)) {
    const sheet = lesson.data.templates.includes(name) ? findTemplate(lesson.id, name) : undefined;
    if (!sheet) {
      problems.push(`templates.${name}: the English lesson has no sheet "${name}"`);
      continue;
    }
    const parts = words.parts ?? [];
    if (parts.length !== sheet.sheet.parts.length)
      problems.push(
        `templates.${name}: the English sheet has ${sheet.sheet.parts.length} parts, this has ${parts.length}`
      );
    parts.forEach((p, i) => {
      const en = sheet.sheet.parts[i];
      if (en && p?.notes && p.notes.length !== en.notes.length)
        problems.push(
          `templates.${name}: part ${i + 1} (${en.name}) has ${en.notes.length} notes in English, this has ${p.notes.length}`
        );
    });
  }
  return problems;
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
        for (const p of sheetProblems(english, entry.data.templates))
          problems.push(`${where}: ${p}`);
      }
      const stale =
        entry.data.translated_from !== (await translationHash(file, templateFiles(lesson)));
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
  /** Template sheets with words in the lesson's language (spec §2.1), by sheet name. */
  sheets: Record<string, SheetWords>;
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
    notice: lang === 'en' ? null : 'english',
    sheets: {}
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
    notice: view === 'live' ? null : view,
    sheets: w.templates
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
