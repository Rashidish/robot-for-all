// Content review decisions (docs/specs/back-office-content-review.md): one decision on one
// lesson becomes one pull request changing only its status lines, plus a record in the database.
// The database checks the role, the ticks, the notes and the "not your own" rule; if it refuses,
// the pull request is closed again so nothing is left behind.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GitHub, Pull } from './github';
import { afterDecision, type LessonSummary, summarise, withStatus } from './lessons';

export type Decision =
  'sent_for_review' | 'approved' | 'changes_requested' | 'build_tested' | 'unpublished';

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
  { key: 'ai_read', label: 'I read every section (required for AI-drafted lessons)' }
];

export const lessonPath = (id: string) => `content/lessons/${id}/index.md`;

/** Which decisions make sense now (the database still checks roles and rules). */
export function possibleDecisions(l: LessonSummary): Decision[] {
  const out: Decision[] = [];
  if (l.status === 'draft') out.push('sent_for_review');
  if (l.status === 'in_review' && !l.reviewedBy) out.push('approved', 'changes_requested');
  if (!l.buildTestedBy) out.push('build_tested');
  if (l.status === 'published') out.push('unpublished');
  return out;
}

/** Reads every lesson on main. */
export async function readLessons(gh: GitHub): Promise<LessonSummary[]> {
  const ids = await gh.listDirs('content/lessons');
  const lessons = await Promise.all(
    ids.map(async (id) => summarise(id, (await gh.readFile(lessonPath(id))).text))
  );
  return lessons.sort((a, b) => a.id.localeCompare(b.id));
}

/** The open back-office pull request for each lesson, by lesson id. */
export function pullsByLesson(pulls: Pull[]): Map<string, Pull> {
  const map = new Map<string, Pull>();
  for (const p of pulls) {
    const m = /^admin\/lesson-(.+)-\d{8}-\d{6}$/.exec(p.head.ref);
    if (m?.[1]) map.set(m[1], p);
  }
  return map;
}

export async function decide(
  gh: GitHub,
  supabase: SupabaseClient,
  input: {
    lessonId: string;
    decision: Decision;
    checklist: Record<string, boolean> | null;
    notes: string;
    overrideReason: string;
    reviewerName: string | null;
    who: string;
    now?: Date;
  }
): Promise<string> {
  const path = lessonPath(input.lessonId);
  const file = await gh.readFile(path);
  const lesson = summarise(input.lessonId, file.text);
  if (!possibleDecisions(lesson).includes(input.decision)) {
    throw new Error('That decision does not fit the lesson’s status now. Reload the page.');
  }
  const text = withStatus(file.text, afterDecision(lesson, input.decision, input.reviewerName));
  const stamp = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const branch = `admin/lesson-${lesson.id}-${stamp}`;
  const title = `${lesson.title} (${lesson.id}): ${DECISION_LABELS[input.decision].toLowerCase()}`;
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
    p_type: 'lesson',
    p_id: lesson.id,
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
