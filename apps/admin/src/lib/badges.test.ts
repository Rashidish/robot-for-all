import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  describeRule,
  makeBadgeKind,
  onlyBadgeStatusChanged,
  summariseBadge,
  withBadgeStatus
} from './badges';
import { possibleDecisions } from './kinds';

const text = readFileSync('content/badges/lever-master.json', 'utf8');
const names = { badge_lever_master_name: 'Lever Master' };

describe('Configuration → Badges', () => {
  it('reads a badge file: its name, rule in words, status; never a build test', () => {
    const b = summariseBadge('lever-master', text, names);
    expect(b).toMatchObject({
      title: 'Lever Master',
      status: 'draft',
      reviewedBy: null,
      buildTestedBy: 'n/a',
      rule: 'Finish every live lever lesson'
    });
    expect(possibleDecisions(b)).toEqual(['sent_for_review']);
  });

  it('puts rules in plain words', () => {
    expect(describeRule({ kind: 'lessons_done', count: 1 })).toBe('Finish any 1 lesson');
    expect(describeRule({ kind: 'phase_done', phase: 2, count: 3 })).toBe(
      'Finish 3 Phase 2 lessons'
    );
    expect(describeRule({ kind: 'all_ican', count: 2 })).toBe('Every “I can” Yes on 2 lessons');
  });

  it('a decision changes only the status lines, and the merge check accepts only that', () => {
    const kind = makeBadgeKind(names);
    const b = kind.summarise('lever-master', text);
    const approved = kind.withStatus(text, kind.after(b, 'approved', 'Reviewer 3'));
    expect(JSON.parse(approved)).toMatchObject({ status: 'published', reviewed_by: 'Reviewer 3' });
    expect(onlyBadgeStatusChanged(text, approved)).toBe(true);
    expect(onlyBadgeStatusChanged(text, approved.replace('"lever"', '"crank"'))).toBe(false);
    expect(() => withBadgeStatus('{}', { status: 'published' })).toThrow(/no "status" line/);
  });
});
