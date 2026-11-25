// Content review decisions (docs/specs/back-office-content-review.md, more content spec): one
// decision on one item (a lesson, a world or course) becomes one pull request changing only its
// status lines, plus a record in the database.
// The database checks the role, the ticks, the notes and the "not your own" rule; if it refuses,
// the pull request is closed again so nothing is left behind.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GitHub, Pull } from './github';
import { type ContentKind, type Decision, type Item, possibleDecisions } from './kinds';
import {
  afterDecision,
  type LessonSummary,
  onlyStatusChanged,
  summarise,
  withStatus
} from './lessons';
import {
  onlyWorldStatusChanged,
  summariseWorld,
  type WorldSummary,
  withWorldStatus
} from './worlds';

export { possibleDecisions };
export type { Decision };

export const DECISION_LABELS: Record<Decision, string> = {
  sent_for_review: 'Sent for review',
  approved: 'Approved',
  changes_requested: 'Changes asked for',
  build_tested: 'Built and works',
  unpublished: 'Unpublished'
};

export const CHECKLIST: { key: string; label: string }[] = [
  {
    key: 'safety',
    label:
      'Safety: adult help marked; no coin or button cells; no mains; sharp tools only with an adult'
  },
  {
    key: 'electrical',
    label:
      'Electrical design (Phase 2+): battery only, low voltage, current within the parts’ limits (tick for Phase 1: none)'
  },
  {
    key: 'age_language',
    label: 'Right for the grades; plain words; no learner personal data asked for'
  },
  { key: 'caps', label: 'CAPS links look right ("to confirm" ones confirmed or removed)' },
  {
    key: 'parts_cost',
    label: 'Parts are cheap, with substitutes; the cost estimate is believable'
  },
  {
    key: 'templates',
    label:
      'Templates: printed at 100 % and measured (the 50 mm square is 50 mm); fold and cut lines right'
  },
  { key: 'ai_read', label: 'I read every section (required for AI-drafted lessons)' }
];

export const lessonPath = (id: string) => `content/lessons/${id}/index.md`;

export const LESSON: ContentKind<LessonSummary> = {
  type: 'lesson',
  noun: 'lesson',
  path: lessonPath,
  list: { folder: 'content/lessons', entries: 'dirs' },
  summarise,
  withStatus,
  onlyStatusChanged,
  after: afterDecision,
  checklist: CHECKLIST
};

/** What a reviewer checks for a world or course (more content spec §2.2). */
export const WORLD_CHECKLIST: { key: string; label: string }[] = [
  { key: 'challenge_clear', label: 'The challenge text is clear for the grade band' },
  {
    key: 'can_finish',
    label: 'A sensible program can finish it on screen (try it in the drafts preview)'
  },
  { key: 'fair_points', label: 'Missions and points are fair' },
  {
    key: 'fits_floor',
    label: 'Printed (Print course), it fits a classroom floor: size and tile count are sensible'
  },
  { key: 'child_theme', label: 'The theme, names and words are right for children' }
];

/** Worlds and courses: approving publishes (a floor build test is recorded when done, not required). */
export function makeWorldKind(names: Record<string, string>): ContentKind<WorldSummary> {
  return {
    type: 'world',
    noun: 'world',
    path: (id) => `content/worlds/${id}.json`,
    list: { folder: 'content/worlds', entries: 'json-files' },
    summarise: (id, text) => summariseWorld(id, text, names),
    withStatus: withWorldStatus,
    onlyStatusChanged: onlyWorldStatusChanged,
    after: (_w, decision, name) => {
      switch (decision) {
        case 'sent_for_review':
          return { status: 'in_review' };
        case 'approved':
          return { reviewedBy: name, status: 'published' };
        case 'build_tested':
          return { buildTestedBy: name };
        case 'changes_requested':
        case 'unpublished':
          return { status: 'draft', reviewedBy: null };
      }
    },
    checklist: WORLD_CHECKLIST
  };
}

/** Reads every item of a kind on main. */
export async function readItems<T extends Item>(gh: GitHub, kind: ContentKind<T>): Promise<T[]> {
  const ids =
    kind.list.entries === 'dirs'
      ? await gh.listDirs(kind.list.folder)
      : (await gh.listDir(kind.list.folder))
          .filter((f) => f.name.endsWith('.json'))
          .map((f) => f.name.replace(/\.json$/, ''));
  const items = await Promise.all(
    ids.map(async (id) => kind.summarise(id, (await gh.readFile(kind.path(id))).text))
  );
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

export const readLessons = (gh: GitHub) => readItems(gh, LESSON);

/** The open back-office pull request for each item of a kind, by id. */
export function pullsFor(
  type: 'lesson' | 'world' | 'language' | 'translation' | 'badge',
  pulls: Pull[]
): Map<string, Pull> {
  const map = new Map<string, Pull>();
  const re = new RegExp(`^admin/${type}-(.+)-\\d{8}-\\d{6}$`);
  for (const p of pulls) {
    const m = re.exec(p.head.ref);
    if (m?.[1]) map.set(m[1], p);
  }
  return map;
}

export const pullsByLesson = (pulls: Pull[]) => pullsFor('lesson', pulls);

export async function decide<T extends Item>(
  gh: GitHub,
  supabase: SupabaseClient,
  kind: ContentKind<T>,
  input: {
    id: string;
    decision: Decision;
    checklist: Record<string, boolean> | null;
    notes: string;
    overrideReason: string;
    reviewerName: string | null;
    who: string;
    now?: Date;
  }
): Promise<string> {
  const path = kind.path(input.id);
  const file = await gh.readFile(path);
  const item = kind.summarise(input.id, file.text);
  if (!possibleDecisions(item).includes(input.decision)) {
    throw new Error(`That decision does not fit the ${kind.noun}’s status now. Reload the page.`);
  }
  const text = kind.withStatus(file.text, kind.after(item, input.decision, input.reviewerName));
  const stamp = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const branch = `admin/${kind.type}-${item.id}-${stamp}`;
  const title = `${item.title} (${item.id}): ${DECISION_LABELS[input.decision].toLowerCase()}`;
  const url = await gh.proposeChange({
    branch,
    path,
    text,
    sha: file.sha,
    message: `${title} (back office)`,
    title,
    body:
      `Decided in the back office by ${input.who}.` +
      (input.notes ? `\n\n> ${input.notes.replace(/\n/g, '\n> ')}` : '') +
      '\n\nOnly the status lines change. The back office merges this after CI passes (ADR-0012).'
  });
  const number = gh.lastPullNumber;
  const { error } = await supabase.rpc('record_review', {
    p_type: kind.type,
    p_id: item.id,
    p_decision: input.decision,
    p_checklist: input.checklist,
    p_notes: input.notes || null,
    p_pull_request: url,
    p_override_reason: input.overrideReason || null
  });
  if (error) {
    await gh.closePull(number, branch).catch(() => undefined);
    throw new Error(error.message);
  }
  return url;
}
