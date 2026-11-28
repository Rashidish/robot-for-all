// Machines step 3 (migration 0030): topics are reviewed like badges, with their own checklist and
// no build test, and can be withdrawn.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const EDITOR = '00000000-0000-4000-8000-000000000002';
const REVIEWER = '00000000-0000-4000-8000-000000000003';
const TESTER = '00000000-0000-4000-8000-000000000004';
const PR = 'https://github.com/Rashidish/robots-for-all/pull/301';
const TICKS = {
  explains_right: true,
  safety: true,
  stand_ins: true,
  picture_no_words: true,
  age_language: true,
  caps: true,
  ai_read: true
};
let t: TestDb;

const review = (
  user: string,
  decision: string,
  checklist: unknown = null,
  notes: string | null = null
) =>
  t.as(user, `select public.record_review('machine', 'bushing', $1, $2, $3, $4) as id`, [
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

describe('Machines topic reviews (migration 0030)', () => {
  it('sent for review, then approved with every topic tick', async () => {
    await expect(review(REVIEWER, 'sent_for_review')).rejects.toThrow(/content editor/);
    await review(EDITOR, 'sent_for_review');
    await expect(
      review(REVIEWER, 'approved', { ...TICKS, picture_no_words: false })
    ).rejects.toThrow(/picture_no_words/);
    await review(REVIEWER, 'approved', TICKS);
    const rows = await t.owner<{ content_type: string; decision: string }>(
      `select content_type, decision from public.content_reviews order by id`
    );
    expect(rows).toEqual([
      { content_type: 'machine', decision: 'sent_for_review' },
      { content_type: 'machine', decision: 'approved' }
    ]);
  });

  it('has no build test', async () => {
    await expect(review(TESTER, 'build_tested', null, 'built and tested it')).rejects.toThrow(
      /no build test/
    );
  });

  it('can be withdrawn and restored by a reviewer', async () => {
    await t.as(
      REVIEWER,
      `select public.record_withdrawal('machine', 'bushing', 'withdrawn', 'Picture shows the wrong part', $1)`,
      [PR]
    );
    await expect(
      t.as(
        EDITOR,
        `select public.record_withdrawal('machine', 'bushing', 'restored', 'Picture is fixed now', $1)`,
        [PR]
      )
    ).rejects.toThrow(/owner or reviewer/);
  });
});
