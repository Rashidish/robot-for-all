// Content → Lessons (docs/specs/back-office-content-review.md): read lessons' front matter and
// change only their status fields. The lesson text is never touched: every change is checked to
// differ from the original in those lines only (ADR-0012 condition 2).

export const STATUS_FIELDS = ['status', 'reviewed_by', 'build_tested_by'] as const;
export type StatusField = (typeof STATUS_FIELDS)[number];
export type LessonStatus = 'draft' | 'in_review' | 'published';

export interface LessonSummary {
  id: string;
  title: string;
  phase: number;
  grades: number[];
  status: LessonStatus;
  reviewedBy: string | null;
  buildTestedBy: string | null;
  aiGenerated: boolean;
  /** Template sheet names (content/projects/<id>/templates/<name>.ts). */
  templates: string[];
}

const FRONT = /^---\n([\s\S]*?)\n---\n/;

/** The value of a top-level `key: value` line in the front matter, as written. */
function field(front: string, key: string): string | null {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(front);
  return m ? (m[1] ?? '').trim() : null;
}

const scalar = (v: string | null): string | null => {
  if (v === null || v === '' || v === 'null' || v === '~') return null;
  return v.replace(/^(['"])(.*)\1$/, '$2');
};

/** The bits of a lesson's front matter the review screens need. */
export function summarise(id: string, text: string): LessonSummary {
  const front = FRONT.exec(text)?.[1] ?? '';
  const status = scalar(field(front, 'status'));
  return {
    id,
    title: scalar(field(front, 'title')) ?? id,
    phase: Number(field(front, 'phase') ?? 0),
    grades: (field(front, 'grades') ?? '')
      .replace(/[[\]\s]/g, '')
      .split(',')
      .filter(Boolean)
      .map(Number),
    status: status === 'in_review' || status === 'published' ? status : 'draft',
    reviewedBy: scalar(field(front, 'reviewed_by')),
    buildTestedBy: scalar(field(front, 'build_tested_by')),
    aiGenerated: field(front, 'ai_generated') === 'true',
    templates: (field(front, 'templates') ?? '')
      .replace(/[[\]\s]/g, '')
      .split(',')
      .filter(Boolean)
  };
}

/** YAML for a reviewer name: quoted, so names like "Reviewer: 3" stay one value. */
const yamlName = (name: string | null): string =>
  name === null ? 'null' : JSON.stringify(name.trim());

/**
 * The lesson file with new status fields. Only those lines change; throws if a field is
 * missing (the build's schema requires all three), so a change can never touch anything else.
 */
export function withStatus(
  text: string,
  change: { status?: LessonStatus; reviewedBy?: string | null; buildTestedBy?: string | null }
): string {
  const m = FRONT.exec(text);
  if (!m) throw new Error('lesson has no front matter');
  let front = m[1] ?? '';
  const set = (key: StatusField, value: string) => {
    const re = new RegExp(`^${key}:.*$`, 'm');
    if (!re.test(front)) throw new Error(`lesson front matter has no ${key} line`);
    front = front.replace(re, `${key}: ${value}`);
  };
  if (change.status !== undefined) set('status', change.status);
  if (change.reviewedBy !== undefined) set('reviewed_by', yamlName(change.reviewedBy));
  if (change.buildTestedBy !== undefined) set('build_tested_by', yamlName(change.buildTestedBy));
  return text.replace(FRONT, `---\n${front}\n---\n`);
}

/** True when two versions of a lesson differ only in the status lines (ADR-0012 condition 2). */
export function onlyStatusChanged(before: string, after: string): boolean {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length !== b.length) return false;
  const status = new RegExp(`^(${STATUS_FIELDS.join('|')}):`);
  return a.every((line, i) => line === b[i] || (status.test(line) && status.test(b[i] ?? '')));
}

/**
 * What a decision does to the status fields. A lesson goes live only with both a review and a
 * build test (the build's schema), so whichever comes second publishes it.
 */
export function afterDecision(
  lesson: LessonSummary,
  decision: 'sent_for_review' | 'approved' | 'changes_requested' | 'build_tested' | 'unpublished',
  name: string | null
): { status?: LessonStatus; reviewedBy?: string | null; buildTestedBy?: string | null } {
  switch (decision) {
    case 'sent_for_review':
      return { status: 'in_review' };
    case 'approved':
      return { reviewedBy: name, status: lesson.buildTestedBy ? 'published' : 'in_review' };
    case 'build_tested':
      return { buildTestedBy: name, ...(lesson.reviewedBy ? { status: 'published' } : {}) };
    case 'changes_requested':
      return { status: 'draft', reviewedBy: null };
    case 'unpublished':
      return { status: 'draft', reviewedBy: null };
  }
}
