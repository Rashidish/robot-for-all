// Seasons (M4 spec FR-20): content/seasons/<id>.json, each with its artwork <id>.svg, checked
// when the site is built. A season with a mistake, or naming a course that doesn't exist,
// fails the build.
import { checkSeason } from '../../../../packages/sim/src/season';
import { worldIds } from './worlds';

const files = import.meta.glob<unknown>('../../../../content/seasons/*.json', {
  eager: true,
  import: 'default'
});
const art = new Set(
  Object.keys(import.meta.glob('../../../../content/seasons/*.svg')).map((p) =>
    (p.split('/').pop() ?? p).replace(/\.svg$/, '')
  )
);

/** Every problem in every season file, as "<file>: <path>: <message>". */
export function seasonProblems(): string[] {
  const worlds = worldIds();
  const problems: string[] = [];
  const numbers = new Map<number, string>();
  for (const [path, spec] of Object.entries(files)) {
    const file = path.split('/').pop() ?? path;
    for (const p of checkSeason(spec, worlds))
      problems.push(`content/seasons/${file}: ${p.path}: ${p.message}`);
    const { id, number } = spec as { id?: unknown; number?: unknown };
    if (`${String(id)}.json` !== file)
      problems.push(`content/seasons/${file}: $.id must match the file name`);
    if (!art.has(String(id)))
      problems.push(
        `content/seasons/${file}: artwork content/seasons/${String(id)}.svg is missing`
      );
    if (typeof number === 'number') {
      const other = numbers.get(number);
      if (other) problems.push(`content/seasons/${file}: season ${number} is also ${other}`);
      numbers.set(number, file);
    }
  }
  return problems;
}
