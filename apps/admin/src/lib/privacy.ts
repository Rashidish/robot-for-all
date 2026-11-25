// Privacy → Due for deletion (M5 spec v0.5 §7.5). The database decides and logs everything
// (migration 0015); this only shapes the list for the page.

export interface DueRow {
  user_id: string;
  display_name: string;
  account_kind: string;
  linked_to: string;
  last_seen_at: string;
  learners_to_go: number;
  due_since: string;
  locked_until: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Where an account is in the process: waiting for confirmation, overdue (> 7 days), or locked. */
export function stageOf(row: DueRow, now = Date.now()): 'waiting' | 'overdue' | 'locked' {
  if (row.locked_until && Date.parse(row.locked_until) > now) return 'locked';
  return now - Date.parse(row.due_since) > 7 * DAY ? 'overdue' : 'waiting';
}

/** Days until the account is locked (30 days after it became due) or deleted (end of the lock). */
export function daysLeft(row: DueRow, now = Date.now()): number {
  const end = row.locked_until
    ? Date.parse(row.locked_until)
    : Date.parse(row.due_since) + 30 * DAY;
  return Math.max(0, Math.ceil((end - now) / DAY));
}

export const STAGE_LABELS = {
  waiting: 'Waiting for confirmation',
  overdue: 'Waiting more than 7 days',
  locked: 'Locked (deleted when the lock ends)'
} as const;

/** The ticked accounts from the form: only ids that are on the list. */
export function tickedUsers(form: FormData, rows: DueRow[]): string[] {
  const listed = new Set(rows.map((r) => r.user_id));
  return form
    .getAll('user')
    .map(String)
    .filter((id) => listed.has(id));
}
