import { describe, expect, it } from 'vitest';
import { daysLeft, type DueRow, stageOf, tickedUsers } from './privacy';

const NOW = Date.parse('2026-12-31T00:00:00Z');
const row = (due: string, locked: string | null = null): DueRow => ({
  user_id: 'u1',
  display_name: 'Mrs Dlamini',
  account_kind: 'parent',
  linked_to: 'Mrs Dlamini',
  last_seen_at: '2025-12-01T00:00:00Z',
  learners_to_go: 1,
  due_since: due,
  locked_until: locked
});

describe('Privacy → Due for deletion', () => {
  it('knows the stage: waiting, overdue after 7 days, locked', () => {
    expect(stageOf(row('2026-12-28T00:00:00Z'), NOW)).toBe('waiting');
    expect(stageOf(row('2026-12-20T00:00:00Z'), NOW)).toBe('overdue');
    expect(stageOf(row('2026-11-20T00:00:00Z', '2027-01-20T00:00:00Z'), NOW)).toBe('locked');
  });

  it('counts the days to the lock, or to deletion once locked', () => {
    expect(daysLeft(row('2026-12-21T00:00:00Z'), NOW)).toBe(20);
    expect(daysLeft(row('2026-11-01T00:00:00Z', '2027-01-10T00:00:00Z'), NOW)).toBe(10);
    expect(daysLeft(row('2026-10-01T00:00:00Z'), NOW)).toBe(0);
  });

  it('takes only listed accounts from the form', () => {
    const form = new FormData();
    form.append('user', 'u1');
    form.append('user', 'someone-else');
    expect(tickedUsers(form, [row('2026-12-28T00:00:00Z')])).toEqual(['u1']);
  });
});
