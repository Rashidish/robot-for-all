// Content → Machines (machines spec FR-12): topics are reviewed like lessons, with no build test.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { possibleDecisions } from './kinds';
import { MACHINE, summariseMachine } from './machines';
import { checkWithdrawn } from '../../../../packages/settings/src/withdrawn';

const text = readFileSync('content/machines/bushing/index.md', 'utf8');

describe('Content → Machines', () => {
  it('reads a topic: title, family, card and status; never a build test', () => {
    const t = summariseMachine('bushing', text);
    expect(t).toMatchObject({ id: 'bushing', title: 'Bushing', buildTestedBy: 'n/a' });
    expect(t.family).toBe('wheels-bearings');
    expect(t.card.length).toBeGreaterThan(10);
    expect(possibleDecisions({ ...t, status: 'draft', reviewedBy: null })).toEqual([
      'sent_for_review'
    ]);
    expect(possibleDecisions({ ...t, status: 'in_review', reviewedBy: null })).toEqual([
      'approved',
      'changes_requested'
    ]);
  });

  it('approving publishes; only the status lines change, and the merge check accepts only that', () => {
    const t = { ...summariseMachine('bushing', text), status: 'in_review' as const };
    const draft = text.replace(/^status:.*$/m, 'status: in_review');
    const approved = MACHINE.withStatus(draft, MACHINE.after(t, 'approved', 'Reviewer 3'));
    expect(approved).toMatch(/^status: published$/m);
    expect(approved).toMatch(/^reviewed_by: "Reviewer 3"$/m);
    expect(MACHINE.onlyStatusChanged(draft, approved)).toBe(true);
    expect(MACHINE.onlyStatusChanged(draft, approved.replace('Bushing', 'Bush'))).toBe(false);
    const back = MACHINE.withStatus(approved, MACHINE.after(t, 'unpublished', null));
    expect(back).toMatch(/^status: draft$/m);
    expect(back).toMatch(/^reviewed_by: null$/m);
  });

  it('a topic can be withdrawn by id', () => {
    const item = { type: 'machine', id: 'bushing', reason: 'Wrong picture', since: '2026-11-28' };
    expect(checkWithdrawn({ items: [item] })).toEqual([]);
    expect(checkWithdrawn({ items: [{ ...item, id: 'Bushing!' }] })).toHaveLength(1);
  });
});
