// Junior missions (spec docs/specs/junior.md FR-4): content/junior/<id>.json, in the order given by
// content/junior/order.json. Checked when the site is built: a mission that can't be solved in its
// "best", or is missing from the order, fails the build.
import order from '../../../../content/junior/order.json';
import { type Mission, missionProblems } from '../../../../packages/sim/src/junior';

const files = import.meta.glob<unknown>('../../../../content/junior/*.json', {
  eager: true,
  import: 'default'
});

const byId = new Map<string, unknown>(
  Object.entries(files)
    .map(
      ([path, spec]) =>
        [
          path
            .split('/')
            .pop()
            ?.replace(/\.json$/, '') ?? path,
          spec
        ] as const
    )
    .filter(([id]) => id !== 'order')
);

export function juniorProblems(): string[] {
  const problems: string[] = [];
  for (const [id, spec] of byId) {
    for (const p of missionProblems(spec, id)) problems.push(`content/junior/${p}`);
    if (!order.missions.includes(id)) problems.push(`content/junior/order.json: add "${id}"`);
  }
  for (const id of order.missions) {
    if (!byId.has(id)) problems.push(`content/junior/order.json: "${id}" has no mission file`);
  }
  return problems;
}

/** The missions, easiest first. */
export const juniorMissions = (): Mission[] =>
  order.missions.flatMap((id) => (byId.has(id) ? [byId.get(id) as Mission] : []));

/** The words key for a mission's name: "bee-to-flower" → "junior_mission_bee_to_flower". */
export const missionKey = (id: string): string => `junior_mission_${id.replace(/-/g, '_')}`;
