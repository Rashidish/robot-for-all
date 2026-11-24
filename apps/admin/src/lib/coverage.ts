// What still needs translating into a language (more content spec §2.8): the back office flags
// every lesson, robot world, challenge and interface word that learners would still see in
// English, so nothing is missed silently.

/** Interface words grouped by where learners meet them (by key prefix). */
export const WORD_AREAS: { area: string; prefixes: string[] }[] = [
  {
    area: 'Robot worlds, challenges and seasons',
    prefixes: ['world_', 'mission_', 'season_', 'robot_', 'sim_']
  },
  {
    area: 'Code editor and blocks',
    prefixes: ['block_', 'category_', 'code_', 'gesture_', 'colour_', 'math_', 'game_', 'needs_']
  },
  {
    area: 'Lessons, answer sheets and templates',
    prefixes: ['lesson', 'sheet_', 'template_', 'slides_']
  },
  { area: 'Site pages and menus', prefixes: [] }
];

export interface WordArea {
  area: string;
  translated: number;
  total: number;
  /** The English text of each missing word, by key. */
  missing: { key: string; english: string }[];
}

const areaOf = (key: string): string =>
  WORD_AREAS.find((a) => a.prefixes.some((p) => key.startsWith(p)))?.area ?? 'Site pages and menus';

/** Interface words per area: how many are translated, and which are missing. */
export function wordCoverage(
  english: Record<string, string>,
  words: Record<string, string>
): WordArea[] {
  const out = new Map(
    WORD_AREAS.map((a) => [
      a.area,
      { area: a.area, translated: 0, total: 0, missing: [] as WordArea['missing'] }
    ])
  );
  for (const [key, text] of Object.entries(english)) {
    if (key.startsWith('$')) continue;
    const a = out.get(areaOf(key));
    if (!a) continue;
    a.total++;
    if (typeof words[key] === 'string' && words[key].trim() !== '') a.translated++;
    else a.missing.push({ key, english: text });
  }
  return [...out.values()].filter((a) => a.total > 0);
}

/** A lesson as learners of another language meet it. */
export type LessonState =
  | 'not_translated'
  | 'draft'
  | 'in_review'
  | 'published'
  /** Translated, but the English lesson changed since: learners see English. */
  | 'needs_updating';

export interface LessonCoverage {
  id: string;
  title: string;
  englishStatus: 'draft' | 'in_review' | 'published';
  state: LessonState;
  /** Template sheets the translation has no words for: they print in English (spec §2.1). */
  englishSheets: string[];
  /** The lesson has a starter program, but the translation gives it no name (spec §2.6). */
  englishProgram: boolean;
  /** Live in English but not (fully) in this language: learners see some of it in English. */
  flagged: boolean;
}

export function lessonCoverage(
  lessons: {
    id: string;
    title: string;
    status: 'draft' | 'in_review' | 'published';
    hash: string;
    /** The lesson's template sheet names. */
    templates?: string[];
    /** True when the lesson has a starter program. */
    program?: boolean;
  }[],
  translations: {
    lesson: string;
    status: 'draft' | 'in_review' | 'published';
    translatedFrom: string | null;
    /** Sheets the translation has words for. */
    templates?: string[];
    /** True when the translation names the starter program. */
    programName?: boolean;
  }[]
): LessonCoverage[] {
  const byLesson = new Map(translations.map((t) => [t.lesson, t]));
  return lessons.map((l) => {
    const t = byLesson.get(l.id);
    const state: LessonState = !t
      ? 'not_translated'
      : t.translatedFrom !== l.hash
        ? 'needs_updating'
        : t.status;
    const englishSheets = t
      ? (l.templates ?? []).filter((s) => !(t.templates ?? []).includes(s))
      : (l.templates ?? []);
    const englishProgram = Boolean(l.program) && !t?.programName;
    return {
      id: l.id,
      title: l.title,
      englishStatus: l.status,
      state,
      englishSheets,
      englishProgram,
      flagged:
        l.status === 'published' &&
        (state !== 'published' || englishSheets.length > 0 || englishProgram)
    };
  });
}

export const LESSON_STATE_LABELS: Record<LessonState, string> = {
  not_translated: 'Not translated',
  draft: 'Draft translation',
  in_review: 'In review',
  published: 'Published',
  needs_updating: 'Needs updating'
};
