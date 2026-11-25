// Badges (M5 spec §4.4): content/badges/<id>.json with artwork <id>.svg (no words), reviewed like
// other content. Names and descriptions are interface words, badge_<id>_name and
// badge_<id>_about, so they are translated and flagged like everything else. A badge is earned
// from a learner's recorded answer sheets by its rule; "Not yet" never counts (owner decision).

export type Rule =
  /** Any `count` lessons done: every box ticked, every "I can" Yes, built and working. */
  | { kind: 'lessons_done'; count: number }
  /** Any `count` lessons with every "I can" answered Yes. */
  | { kind: 'all_ican'; count: number }
  /** `count` lessons of one phase done. */
  | { kind: 'phase_done'; phase: 1 | 2 | 3; count: number }
  /** Every published lesson of one mechanism done. */
  | { kind: 'mechanism_done'; mechanism: string };

export interface Badge {
  id: string;
  rule: Rule;
  status: 'draft' | 'in_review' | 'published';
  ai_generated: boolean;
  reviewed_by: string | null;
}

export interface BadgeProblem {
  path: string;
  message: string;
}

/** What the rules need to know about the published lessons. */
export interface LessonFacts {
  id: string;
  phase: number;
  mechanism: string;
}

/** One learner's result for one lesson (from their newest record that isn't revoked). */
export interface LessonResult {
  lesson: string;
  done: boolean;
  allYes: boolean;
}

// Letters only: the id is also part of the badge's words keys, which can't hold digits.
const ID_RE = /^[a-z]+(-[a-z]+)*$/;
const KEYS = ['id', 'rule', 'status', 'ai_generated', 'reviewed_by'];

/** Every problem with a badge file, given the published lessons. */
export function checkBadge(spec: unknown, lessons: readonly LessonFacts[]): BadgeProblem[] {
  const out: BadgeProblem[] = [];
  const err = (path: string, message: string) => out.push({ path, message });
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    err('$', 'must be an object');
    return out;
  }
  const b = spec as Record<string, unknown>;
  for (const k of Object.keys(b)) if (!KEYS.includes(k)) err(`$.${k}`, 'is not a badge field');
  if (typeof b['id'] !== 'string' || !ID_RE.test(b['id']))
    err('$.id', 'must be lower-case-with-dashes');
  if (!['draft', 'in_review', 'published'].includes(String(b['status']))) {
    err('$.status', 'must be draft, in_review or published');
  }
  if (typeof b['ai_generated'] !== 'boolean') err('$.ai_generated', 'must be true or false');
  const reviewed = b['reviewed_by'];
  if (reviewed !== null && typeof reviewed !== 'string')
    err('$.reviewed_by', 'must be a name or null');
  if (b['status'] === 'published' && !reviewed) err('$.reviewed_by', 'is required to publish');
  const r = b['rule'] as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') {
    err('$.rule', 'must be an object');
    return out;
  }
  const count = r['count'];
  const goodCount =
    typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 50;
  switch (r['kind']) {
    case 'lessons_done':
    case 'all_ican':
      if (!goodCount) err('$.rule.count', 'must be a whole number from 1 to 50');
      break;
    case 'phase_done': {
      const phase = r['phase'];
      if (phase !== 1 && phase !== 2 && phase !== 3) err('$.rule.phase', 'must be 1, 2 or 3');
      if (!goodCount) err('$.rule.count', 'must be a whole number from 1 to 50');
      else if (lessons.filter((l) => l.phase === phase).length < (count as number)) {
        err('$.rule.count', `is more than the ${String(phase)} phase's published lessons`);
      }
      break;
    }
    case 'mechanism_done':
      if (!lessons.some((l) => l.mechanism === r['mechanism'])) {
        err('$.rule.mechanism', 'no published lesson has this mechanism');
      }
      break;
    default:
      err('$.rule.kind', 'must be lessons_done, all_ican, phase_done or mechanism_done');
  }
  return out;
}

/** True when the results earn the badge. */
export function earns(
  rule: Rule,
  results: readonly LessonResult[],
  lessons: readonly LessonFacts[]
): boolean {
  const facts = new Map(lessons.map((l) => [l.id, l]));
  const done = results.filter((r) => r.done && facts.has(r.lesson));
  switch (rule.kind) {
    case 'lessons_done':
      return done.length >= rule.count;
    case 'all_ican':
      return results.filter((r) => r.allYes && facts.has(r.lesson)).length >= rule.count;
    case 'phase_done':
      return done.filter((r) => facts.get(r.lesson)?.phase === rule.phase).length >= rule.count;
    case 'mechanism_done': {
      const need = lessons.filter((l) => l.mechanism === rule.mechanism).map((l) => l.id);
      const have = new Set(done.map((r) => r.lesson));
      return need.length > 0 && need.every((id) => have.has(id));
    }
  }
}
