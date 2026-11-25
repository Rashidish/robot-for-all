// Badges (M5 spec FR-17): content/badges/<id>.json, each with its artwork <id>.svg (no words) and
// its words badge_<id>_name and badge_<id>_about. Checked when the site is built: a badge with a
// mistake, a missing picture or missing words fails the build. A published badge must be
// earnable from the lessons that are live; a draft one from any lesson.
import { type Badge, checkBadge, type LessonFacts } from '../../../../packages/badges/src/badge';
import en from '../../../../content/i18n/en.json';

const files = import.meta.glob<unknown>('../../../../content/badges/*.json', {
  eager: true,
  import: 'default'
});
const art = import.meta.glob<string>('../../../../content/badges/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
});
const fileName = (p: string) => p.split('/').pop() ?? p;

/** The words key part for a badge id: first-build → first_build. */
export const badgeKey = (id: string) => id.replace(/-/g, '_');

export function allBadges(): Badge[] {
  return Object.values(files) as Badge[];
}

/** The badge's artwork (SVG text). */
export function badgeArt(id: string): string | undefined {
  return Object.entries(art).find(([p]) => fileName(p) === `${id}.svg`)?.[1];
}

/** Badges to show and award: published ones, or every one in the drafts preview. */
export const liveBadges = (showDrafts: boolean): Badge[] =>
  allBadges()
    .filter((b) => showDrafts || b.status === 'published')
    .sort((a, b) => a.id.localeCompare(b.id));

/** Every problem in every badge file. */
export function badgeProblems(all: LessonFacts[], live: LessonFacts[]): string[] {
  const words = en as Record<string, string>;
  const problems: string[] = [];
  for (const [path, spec] of Object.entries(files)) {
    const file = fileName(path);
    const status = (spec as { status?: unknown }).status;
    for (const p of checkBadge(spec, status === 'published' ? live : all)) {
      problems.push(`content/badges/${file}: ${p.path}: ${p.message}`);
    }
    const id = String((spec as { id?: unknown }).id);
    if (`${id}.json` !== file)
      problems.push(`content/badges/${file}: $.id must match the file name`);
    const svg = badgeArt(id);
    if (!svg) problems.push(`content/badges/${file}: artwork content/badges/${id}.svg is missing`);
    else if (/<text[\s>]/.test(svg)) {
      problems.push(`content/badges/${id}.svg: badge pictures carry no words`);
    }
    for (const part of ['name', 'about']) {
      if (!words[`badge_${badgeKey(id)}_${part}`]) {
        problems.push(`content/badges/${file}: words badge_${badgeKey(id)}_${part} are missing`);
      }
    }
  }
  return problems;
}
