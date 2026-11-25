// Configuration → Badges (M5 step 7c, FR-17): review and publish a badge like a world. A decision
// changes only the badge file's "status" and "reviewed_by" lines (ADR-0012 condition 2); badges
// have no build test (their rule is checked when the site is built).
import type { ContentKind, Item, StatusChange } from './kinds';

export interface BadgeSummary extends Item {
  rule: string;
  aiGenerated: boolean;
}

const STATUS_LINE = /^\s*"(status|reviewed_by)":/;

/** The rule in plain words, for the reviewer. */
export function describeRule(rule: unknown): string {
  const r = (rule ?? {}) as Record<string, unknown>;
  const n = Number(r['count']);
  switch (r['kind']) {
    case 'lessons_done':
      return `Finish any ${n} lesson${n === 1 ? '' : 's'}`;
    case 'all_ican':
      return `Every “I can” Yes on ${n} lesson${n === 1 ? '' : 's'}`;
    case 'phase_done':
      return `Finish ${n} Phase ${String(r['phase'])} lesson${n === 1 ? '' : 's'}`;
    case 'mechanism_done':
      return `Finish every live ${String(r['mechanism'])} lesson`;
    default:
      return 'Unknown rule';
  }
}

export function summariseBadge(
  id: string,
  text: string,
  names: Record<string, string>
): BadgeSummary {
  const spec = JSON.parse(text) as Record<string, unknown>;
  const status = spec['status'];
  const reviewed = spec['reviewed_by'];
  return {
    id,
    title: names[`badge_${id.replaceAll('-', '_')}_name`] ?? id,
    status: status === 'in_review' || status === 'published' ? status : 'draft',
    reviewedBy: typeof reviewed === 'string' && reviewed.trim() ? reviewed : null,
    // A badge has no build test: "n/a" keeps that decision off the page.
    buildTestedBy: 'n/a',
    rule: describeRule(spec['rule']),
    aiGenerated: spec['ai_generated'] === true
  };
}

/** The badge file with new status lines; throws if a line is missing. */
export function withBadgeStatus(text: string, change: StatusChange): string {
  let out = text;
  const set = (key: string, value: string | null) => {
    const re = new RegExp(`^(\\s*)"${key}":.*?(,?)$`, 'm');
    if (!re.test(out)) throw new Error(`badge file has no "${key}" line`);
    out = out.replace(
      re,
      (_m, indent: string, comma: string) => `${indent}"${key}": ${JSON.stringify(value)}${comma}`
    );
  };
  if (change.status !== undefined) set('status', change.status);
  if (change.reviewedBy !== undefined) set('reviewed_by', change.reviewedBy?.trim() ?? null);
  JSON.parse(out);
  return out;
}

/** True when two versions of a badge file differ only in the status lines. */
export function onlyBadgeStatusChanged(before: string, after: string): boolean {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length !== b.length) return false;
  return a.every(
    (line, i) => line === b[i] || (STATUS_LINE.test(line) && STATUS_LINE.test(b[i] ?? ''))
  );
}

export const BADGE_CHECKLIST: { key: string; label: string }[] = [
  {
    key: 'picture_clear',
    label:
      'The picture is clear on a phone and printed, and a Grade 3 learner can tell what it shows'
  },
  { key: 'no_words', label: 'The picture has no words or numbers' },
  {
    key: 'words_right',
    label: 'The name and description are right in every language the site is in'
  },
  { key: 'rule_fair', label: 'The rule is fair and earnable with the lessons that are live' },
  { key: 'child_safe', label: 'Nothing in it is unkind, scary or unsafe for children' }
];

export function makeBadgeKind(names: Record<string, string>): ContentKind<BadgeSummary> {
  return {
    type: 'badge',
    noun: 'badge',
    path: (id) => `content/badges/${id}.json`,
    list: { folder: 'content/badges', entries: 'json-files' },
    summarise: (id, text) => summariseBadge(id, text, names),
    withStatus: withBadgeStatus,
    onlyStatusChanged: onlyBadgeStatusChanged,
    after: (_b, decision, name) => {
      switch (decision) {
        case 'sent_for_review':
          return { status: 'in_review' };
        case 'approved':
          return { reviewedBy: name, status: 'published' };
        case 'changes_requested':
        case 'unpublished':
          return { status: 'draft', reviewedBy: null };
        case 'build_tested':
          return {};
      }
    },
    checklist: BADGE_CHECKLIST
  };
}
