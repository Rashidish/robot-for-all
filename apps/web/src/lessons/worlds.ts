// Robot worlds and courses (M4 spec FR-4): content/worlds/<id>.json, checked when the site is
// built. A world with a mistake fails the build with the path to each problem.
import { buildWorld, checkWorld } from '../../../../packages/sim/src/index';

const files = import.meta.glob<unknown>('../../../../content/worlds/*.json', {
  eager: true,
  import: 'default'
});

/** Every problem in every world file, as "<file>: <path>: <message>". */
export function worldProblems(): string[] {
  const problems: string[] = [];
  for (const [path, spec] of Object.entries(files)) {
    const file = path.split('/').pop() ?? path;
    for (const p of checkWorld(spec))
      problems.push(`content/worlds/${file}: ${p.path}: ${p.message}`);
    const id = (spec as { id?: unknown }).id;
    if (`${String(id)}.json` !== file)
      problems.push(`content/worlds/${file}: $.id must match the file name`);
  }
  return problems;
}

/** The ids of all worlds, for checking lessons' `world:` field. */
export function worldIds(): Set<string> {
  return new Set(
    Object.values(files).flatMap((spec) => {
      try {
        return [buildWorld(spec).id];
      } catch {
        return [];
      }
    })
  );
}
