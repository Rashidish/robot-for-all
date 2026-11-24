// Content kinds the back office reviews (lessons, worlds and courses; more later). Each kind says
// where its files are, how to read and change its status lines, what a decision does, and which
// checklist a reviewer ticks. The flow (pull request + record + merge check) is shared.

export type Status = 'draft' | 'in_review' | 'published';
export type Decision =
  'sent_for_review' | 'approved' | 'changes_requested' | 'build_tested' | 'unpublished';

export interface StatusChange {
  status?: Status;
  reviewedBy?: string | null;
  buildTestedBy?: string | null;
}

export interface Item {
  id: string;
  title: string;
  status: Status;
  reviewedBy: string | null;
  buildTestedBy: string | null;
}

export interface ContentKind<T extends Item> {
  type: 'lesson' | 'world';
  noun: string;
  path(id: string): string;
  /** The folder whose entries are the items (sub-folders for lessons, .json files for worlds). */
  list: { folder: string; entries: 'dirs' | 'json-files' };
  summarise(id: string, text: string): T;
  withStatus(text: string, change: StatusChange): string;
  onlyStatusChanged(before: string, after: string): boolean;
  after(item: T, decision: Decision, name: string | null): StatusChange;
  checklist: { key: string; label: string }[];
}

/** Which decisions make sense now (the database still checks roles and rules). */
export function possibleDecisions(i: Item): Decision[] {
  const out: Decision[] = [];
  if (i.status === 'draft') out.push('sent_for_review');
  if (i.status === 'in_review' && !i.reviewedBy) out.push('approved', 'changes_requested');
  if (!i.buildTestedBy) out.push('build_tested');
  if (i.status === 'published') out.push('unpublished');
  return out;
}
