// What still needs translating into a language (more content spec §2.8): the back office flags
// every lesson, robot world, challenge and interface word that learners would still see in
// English, and lists what can't be translated yet, so nothing is missed silently.

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
  /** Live in English but not in this language: learners see it in English. */
  flagged: boolean;
}

export function lessonCoverage(
  lessons: {
    id: string;
    title: string;
    status: 'draft' | 'in_review' | 'published';
    hash: string;
  }[],
  translations: {
    lesson: string;
    status: 'draft' | 'in_review' | 'published';
    translatedFrom: string | null;
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
    return {
      id: l.id,
      title: l.title,
      englishStatus: l.status,
      state,
      flagged: l.status === 'published' && state !== 'published'
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

/**
 * Learner-facing text that has no translation file yet, so it stays in English in every
 * language until it is made translatable (a later change).
 */
export const NOT_TRANSLATABLE: { what: string; where: string }[] = [
  {
    what: 'Template sheets: titles, part names and measurement notes',
    where: 'content/projects/<lesson>/templates/*.ts'
  },
  {
    what: 'Words drawn inside lesson diagrams (mostly wiring labels in Phase 2)',
    where: 'content/lessons/<lesson>/images/*.svg'
  },
  {
    what: 'Starter program names (shown in the code editor)',
    where: 'content/lessons/<lesson>/programs/*.rfa.json'
  }
];
