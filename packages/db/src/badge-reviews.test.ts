// M5 step 7c (migration 0020): badges are reviewed like worlds, with their own checklist and no
// build test.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const EDITOR = '00000000-0000-4000-8000-000000000002';
const REVIEWER = '00000000-0000-4000-8000-000000000003';
const TESTER = '00000000-0000-4000-8000-000000000004';
const PR = 'https://github.com/Rashidish/robots-for-all/pull/201';
const TICKS = {
  picture_clear: true,
  no_words: true,
  words_right: true,
  rule_fair: true,
  child_safe: true
};
let t: TestDb;

const review = (
  user: string,
  decision: string,
  checklist: unknown = null,
  notes: string | null = null
) =>
  t.as(user, `select public.record_review('badge', 'lever-master', $1, $2, $3, $4) as id`, [
    decision,
    checklist,
    notes,
    PR
  ]);

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [EDITOR]: 'editor@example.org',
    [REVIEWER]: 'reviewer@example.org',
    [TESTER]: 'tester@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  for (const [user, role] of [
    [EDITOR, 'content_editor'],
    [REVIEWER, 'reviewer'],
    [TESTER, 'build_tester']
  ] as const) {
    await t.as(ROOT, `select public.grant_role($1, $2)`, [user, role]);
  }
  await t.owner(
    `insert into public.admin_profiles (user_id, reviewer_name) values ($1, 'Reviewer 3'), ($2, 'Tester 4')`,
    [REVIEWER, TESTER]
  );
});

describe('badge reviews (migration 0020)', () => {
  it('sent for review, then approved with every badge tick', async () => {
    await review(EDITOR, 'sent_for_review');
    await expect(review(REVIEWER, 'approved', { ...TICKS, rule_fair: false })).rejects.toThrow(
      /rule_fair/
    );
    await review(REVIEWER, 'approved', TICKS);
    const rows = await t.owner<{ content_type: string; decision: string }>(
      `select content_type, decision from public.content_reviews order by id`
    );
    expect(rows).toEqual([
      { content_type: 'badge', decision: 'sent_for_review' },
      { content_type: 'badge', decision: 'approved' }
    ]);
  });

  it('has no build test', async () => {
    await expect(review(TESTER, 'build_tested', null, 'built and tested it')).rejects.toThrow(
      /no build test/
    );
  });
});
