// Configuration → Seasons (docs/specs/back-office.md §6.5): read the seasons on main and turn a
// date change into a checked file ready for a pull request. The same checks as the public build
// (packages/sim/src/season.ts), so a bad change is caught here before CI sees it.
import { checkSeason, type SeasonProblem } from '../../../../packages/sim/src/season';
import type { GitHub } from './github';

export interface SeasonFile {
  path: string;
  sha: string;
  spec: Record<string, unknown>;
  id: string;
  number: number;
  from: string;
  to: string;
}

/** Reads every season file and every world id from main. */
export async function readSeasons(
  gh: GitHub
): Promise<{ seasons: SeasonFile[]; worldIds: Set<string> }> {
  const [seasonFiles, worldFiles] = await Promise.all([
    gh.listDir('content/seasons'),
    gh.listDir('content/worlds')
  ]);
  const worldIds = new Set(
    worldFiles.filter((f) => f.name.endsWith('.json')).map((f) => f.name.replace(/\.json$/, ''))
  );
  const seasons = await Promise.all(
    seasonFiles
      .filter((f) => f.name.endsWith('.json'))
      .map(async (f) => {
        const { text, sha } = await gh.readFile(f.path);
        const spec = JSON.parse(text) as Record<string, unknown>;
        return {
          path: f.path,
          sha,
          spec,
          id: String(spec['id']),
          number: Number(spec['number']),
          from: String(spec['from']),
          to: String(spec['to'])
        };
      })
  );
  seasons.sort((a, b) => b.number - a.number);
  return { seasons, worldIds };
}

/** The season file with new dates, checked; the text is formatted like the repository's files. */
export function withDates(
  spec: Record<string, unknown>,
  from: string,
  to: string,
  worldIds: ReadonlySet<string>
): { text: string; problems: SeasonProblem[] } {
  const next = { ...spec, from: from.trim(), to: to.trim() };
  return { text: `${JSON.stringify(next, null, 2)}\n`, problems: checkSeason(next, worldIds) };
}

/** A branch name for the change, unique per second: admin/season-rhino-patrol-20261124-153005. */
export function branchFor(id: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return `admin/season-${id}-${stamp}`;
}
