// Seasons (M4 spec FR-20, §14.6): a named, themed set of three courses, one per grade band, with
// its own artwork, active for a date range. Past seasons stay playable. A season is content:
// content/seasons/<id>.json plus <id>.svg, checked when the site is built.

/** The grade bands a season has one course for (spec §14.6). */
export const GRADE_BANDS = ['grade-3-4', 'grade-5-6', 'grade-7-9'] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export interface Season {
  id: string;
  /** Season 1, 2, …: shown as "Season 1". */
  number: number;
  /** Translation keys: season_<id>_name and season_<id>_about. */
  name: string;
  about: string;
  /** First and last day, YYYY-MM-DD, in South African time. */
  from: string;
  to: string;
  courses: Record<GradeBand, string>;
}

export interface SeasonProblem {
  path: string;
  message: string;
}

const ID_RE = /^[a-z]+(-[a-z]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ['id', 'number', 'from', 'to', 'courses'];

const isDate = (s: unknown): s is string =>
  typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Every problem with a season file; `worldIds` are the courses that exist. */
export function checkSeason(spec: unknown, worldIds: ReadonlySet<string>): SeasonProblem[] {
  const out: SeasonProblem[] = [];
  const err = (path: string, message: string) => out.push({ path, message });
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    err('$', 'must be an object');
    return out;
  }
  const o = spec as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) err(`$.${k}`, 'is not a season field');
  if (typeof o.id !== 'string' || !ID_RE.test(o.id))
    err('$.id', 'must be lowercase words joined by hyphens, no digits (e.g. rhino-patrol)');
  if (typeof o.number !== 'number' || !Number.isInteger(o.number) || o.number < 1)
    err('$.number', 'must be a whole number, 1 or more');
  if (!isDate(o.from)) err('$.from', 'must be a date like 2027-01-15');
  if (!isDate(o.to)) err('$.to', 'must be a date like 2027-12-10');
  if (isDate(o.from) && isDate(o.to) && o.to < o.from) err('$.to', 'must not be before $.from');
  const c = o.courses;
  if (c === null || typeof c !== 'object' || Array.isArray(c)) {
    err('$.courses', `must name a course for each grade band: ${GRADE_BANDS.join(', ')}`);
  } else {
    const courses = c as Record<string, unknown>;
    for (const k of Object.keys(courses))
      if (!(GRADE_BANDS as readonly string[]).includes(k))
        err(`$.courses.${k}`, `is not a grade band (${GRADE_BANDS.join(', ')})`);
    for (const band of GRADE_BANDS) {
      const id = courses[band];
      if (typeof id !== 'string') err(`$.courses.${band}`, 'must name a course');
      else if (!worldIds.has(id)) err(`$.courses.${band}`, `no course "${id}" in content/worlds`);
    }
  }
  return out;
}

/** A checked season (call checkSeason first; this throws on a bad one). */
export function buildSeason(spec: unknown, worldIds: ReadonlySet<string>): Season {
  const problems = checkSeason(spec, worldIds);
  if (problems.length > 0) {
    throw new Error(problems.map((p) => `${p.path}: ${p.message}`).join('; '));
  }
  const o = spec as Season;
  const key = o.id.replaceAll('-', '_');
  return {
    id: o.id,
    number: o.number,
    name: `season_${key}_name`,
    about: `season_${key}_about`,
    from: o.from,
    to: o.to,
    courses: { ...o.courses }
  };
}

/** Today's date in South Africa (UTC+2, no daylight saving), as YYYY-MM-DD. */
export function saDate(now: Date): string {
  return new Date(now.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
}

/** Whether the season is still to come, running now or over (still playable). */
export function seasonState(season: Season, today: string): 'upcoming' | 'current' | 'past' {
  if (today < season.from) return 'upcoming';
  if (today > season.to) return 'past';
  return 'current';
}

/** The season a course belongs to, if any. */
export function seasonOf(seasons: readonly Season[], worldId: string): Season | undefined {
  return seasons.find((s) => Object.values(s.courses).includes(worldId));
}
