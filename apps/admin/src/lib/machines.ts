// Content → Machines (docs/specs/machines.md FR-12): topics are reviewed like lessons, with their
// own checklist. Only the status lines ("status", "reviewed_by") change; a topic has no build test
// (its stand-ins are build-tested through the test plan and its topic lessons). Approving
// publishes it.
import type { ContentKind, Item } from './kinds';
import { onlyStatusChanged, summarise, withStatus } from './lessons';

export interface MachineSummary extends Item {
  family: string;
  card: string;
  aiGenerated: boolean;
}

const FRONT = /^---\n([\s\S]*?)\n---\n/;
const field = (front: string, key: string): string | null => {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(front);
  return m ? (m[1] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2') : null;
};

export function summariseMachine(id: string, text: string): MachineSummary {
  const base = summarise(id, text);
  const front = FRONT.exec(text)?.[1] ?? '';
  return {
    id,
    title: base.title,
    status: base.status,
    reviewedBy: base.reviewedBy,
    // "n/a": no build test, so the review screen never offers one (as for badges).
    buildTestedBy: 'n/a',
    family: field(front, 'family') ?? '',
    card: field(front, 'card') ?? '',
    aiGenerated: base.aiGenerated
  };
}

/** What a reviewer checks for a Machines topic (the database requires every tick to approve). */
export const MACHINE_CHECKLIST: { key: string; label: string }[] = [
  {
    key: 'explains_right',
    label: 'How it works is correct, and the card says the same thing in at most 40 words'
  },
  {
    key: 'safety',
    label:
      'Safety: adult help marked; no coin or button cells; no mains; sharp tools only with an adult; syringes without needles'
  },
  {
    key: 'stand_ins',
    label: 'Stand-ins are free or cheap, really work, and the real part is named correctly'
  },
  {
    key: 'picture_no_words',
    label: 'The picture shows the part clearly, has no words, and its alt text describes it'
  },
  { key: 'age_language', label: 'Right for the grades; plain words' },
  { key: 'caps', label: 'CAPS links look right ("to confirm" ones confirmed or removed)' },
  { key: 'ai_read', label: 'I read every section (required for AI-drafted topics)' }
];

export const machinePath = (id: string) => `content/machines/${id}/index.md`;

export const MACHINE: ContentKind<MachineSummary> = {
  type: 'machine',
  noun: 'topic',
  path: machinePath,
  list: { folder: 'content/machines', entries: 'dirs' },
  summarise: summariseMachine,
  withStatus: (text, change) =>
    withStatus(text, {
      ...(change.status !== undefined ? { status: change.status } : {}),
      ...(change.reviewedBy !== undefined ? { reviewedBy: change.reviewedBy } : {})
    }),
  onlyStatusChanged,
  after: (_t, decision, name) => {
    switch (decision) {
      case 'sent_for_review':
        return { status: 'in_review' };
      case 'approved':
        return { reviewedBy: name, status: 'published' };
      case 'build_tested':
        return {};
      case 'changes_requested':
      case 'unpublished':
        return { status: 'draft', reviewedBy: null };
    }
  },
  checklist: MACHINE_CHECKLIST
};
