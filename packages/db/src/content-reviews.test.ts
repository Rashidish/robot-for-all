// Content review decisions (migration 0003; content review spec, ADR-0012).
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const EDITOR = '00000000-0000-4000-8000-000000000002';
const REVIEWER = '00000000-0000-4000-8000-000000000003';
const TESTER = '00000000-0000-4000-8000-000000000004';
const JUDGE = '00000000-0000-4000-8000-000000000005';
const EDITOR_REVIEWER = '00000000-0000-4000-8000-000000000006';
const PR = 'https://github.com/Rashidish/robots-for-all/pull/101';
const ALL_TICKS = {
  safety: true,
  electrical: true,
  age_language: true,
  caps: true,
  parts_cost: true,
  ai_read: true,
  templates: true
};

let t: TestDb;

const review = (
  user: string,
  decision: string,
  opts: { checklist?: unknown; notes?: string; pr?: string; override?: string; id?: string } = {}
) =>
  t.as(user, `select public.record_review('lesson', $1, $2, $3, $4, $5, $6) as id`, [
    opts.id ?? 'p2-art-01',
    decision,
    opts.checklist ?? null,
    opts.notes ?? null,
    opts.pr ?? PR,
    opts.override ?? null
  ]);

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [EDITOR]: 'editor@example.org',
    [REVIEWER]: 'reviewer@example.org',
    [TESTER]: 'tester@example.org',
    [JUDGE]: 'judge@example.org',
    [EDITOR_REVIEWER]: 'both@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  for (const [user, role] of [
    [EDITOR, 'content_editor'],
    [REVIEWER, 'reviewer'],
    [TESTER, 'build_tester'],
    [JUDGE, 'judge'],
    [EDITOR_REVIEWER, 'content_editor'],
    [EDITOR_REVIEWER, 'reviewer']
  ] as const) {
    await t.as(ROOT, `select public.grant_role($1, $2)`, [user, role]);
  }
  for (const [user, name] of [
    [ROOT, 'R. Ishmail'],
    [REVIEWER, 'Reviewer 3'],
    [TESTER, 'T. Builder'],
    [EDITOR_REVIEWER, 'E. Both']
  ] as const) {
    await t.as(user, `select public.set_reviewer_name($1)`, [name]);
  }
});

describe('reviewer names', () => {
  it('each person sets their own; emails and duplicates are refused', async () => {
    const rows = await t.as<{ reviewer_name: string }>(
      REVIEWER,
      `select reviewer_name from public.admin_profiles where user_id = $1`,
      [REVIEWER]
    );
    expect(rows[0]?.reviewer_name).toBe('Reviewer 3');
    await expect(
      t.as(EDITOR, `select public.set_reviewer_name($1)`, ['editor@example.org'])
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.as(EDITOR, `select public.set_reviewer_name($1)`, ['reviewer 3'])
    ).rejects.toThrow(/duplicate key/);
  });
});

describe('who may decide what', () => {
  it('editors send, reviewers approve, build testers test', async () => {
    await review(EDITOR, 'sent_for_review');
    await review(REVIEWER, 'approved', { checklist: ALL_TICKS });
    await review(TESTER, 'build_tested', { notes: 'Built from the printout; it draws a square.' });
    const rows = await t.as<{ decision: string; reviewer_name: string | null }>(
      REVIEWER,
      `select decision, reviewer_name from public.content_reviews order by id`
    );
    expect(rows).toEqual([
      { decision: 'sent_for_review', reviewer_name: null },
      { decision: 'approved', reviewer_name: 'Reviewer 3' },
      { decision: 'build_tested', reviewer_name: 'T. Builder' }
    ]);
  });

  it('refuses decisions outside your role, and without MFA', async () => {
    await expect(review(JUDGE, 'sent_for_review')).rejects.toThrow(/only a content editor/);
    await expect(review(EDITOR, 'approved', { checklist: ALL_TICKS })).rejects.toThrow(
      /only a reviewer/
    );
    await expect(
      review(REVIEWER, 'build_tested', { notes: 'I built it at home.' })
    ).rejects.toThrow(/only a build tester/);
    await expect(
      t.as(
        REVIEWER,
        `select public.record_review('lesson', 'p2-art-01', 'approved', $1, null, null)`,
        [ALL_TICKS],
        { mfa: false }
      )
    ).rejects.toThrow(/only a reviewer/);
  });

  it('approving needs every tick and a reviewer name', async () => {
    await expect(
      review(REVIEWER, 'approved', { checklist: { ...ALL_TICKS, electrical: false } })
    ).rejects.toThrow(/missing: electrical/);
    await expect(review(REVIEWER, 'approved', { checklist: {} })).rejects.toThrow(
      /missing: safety/
    );
    await t.as(ROOT, `select public.grant_role($1, 'reviewer')`, [JUDGE]);
    await expect(review(JUDGE, 'approved', { checklist: ALL_TICKS })).rejects.toThrow(
      /reviewer name first/
    );
  });

  it('asking for changes, build tests and unpublishing need a note', async () => {
    await expect(review(REVIEWER, 'changes_requested', { notes: 'fix' })).rejects.toThrow(
      /at least 10/
    );
    await review(REVIEWER, 'changes_requested', { notes: 'The safety note misses the skewer.' });
    await expect(review(REVIEWER, 'unpublished')).rejects.toThrow(/at least 10/);
  });
});

describe('nobody approves their own lesson', () => {
  it("the person who sent it for review can't approve it", async () => {
    await review(EDITOR_REVIEWER, 'sent_for_review');
    await expect(review(EDITOR_REVIEWER, 'approved', { checklist: ALL_TICKS })).rejects.toThrow(
      /someone else must approve/
    );
    await review(REVIEWER, 'approved', { checklist: ALL_TICKS });
  });

  it('only a super admin can override, with a reason, marked in the audit log', async () => {
    await review(EDITOR_REVIEWER, 'sent_for_review');
    await expect(
      review(EDITOR_REVIEWER, 'approved', { checklist: ALL_TICKS, override: 'no one else here' })
    ).rejects.toThrow(/only a super admin/);
    await t.as(ROOT, `select public.grant_role($1, 'content_editor')`, [ROOT]);
    await review(ROOT, 'sent_for_review', { id: 'p1-crank-01' });
    await expect(
      review(ROOT, 'approved', { id: 'p1-crank-01', checklist: ALL_TICKS, override: 'short' })
    ).rejects.toThrow(/at least 10/);
    await review(ROOT, 'approved', {
      id: 'p1-crank-01',
      checklist: ALL_TICKS,
      override: 'Only one person on the team so far.'
    });
    const log = await t.owner<{ action: string; override_reason: string | null }>(
      `select action, override_reason from public.audit_log where action = 'content.approved'`
    );
    expect(log).toEqual([
      { action: 'content.approved', override_reason: 'Only one person on the team so far.' }
    ]);
  });
});

describe('the merge check and the record', () => {
  it('a pull request can be merged only once a decision is recorded for it', async () => {
    const decided = async (url: string) =>
      (
        await t.as<{ ok: boolean }>(REVIEWER, `select public.approved_pull_request($1) as ok`, [
          url
        ])
      )[0]?.ok;
    expect(await decided(PR)).toBe(false);
    await review(EDITOR, 'sent_for_review');
    expect(await decided(PR)).toBe(true);
    expect(await decided('https://github.com/Rashidish/robots-for-all/pull/999')).toBe(false);
    // Without MFA, nothing counts.
    const noMfa = await t.as<{ ok: boolean }>(
      REVIEWER,
      `select public.approved_pull_request($1) as ok`,
      [PR],
      { mfa: false }
    );
    expect(noMfa[0]?.ok).toBe(false);
  });

  it("decisions can't be changed, deleted or written directly", async () => {
    await review(EDITOR, 'sent_for_review');
    await expect(
      t.as(
        REVIEWER,
        `insert into public.content_reviews (content_type, content_id, decision, user_id) values ('lesson', 'x', 'approved', $1)`,
        [REVIEWER]
      )
    ).rejects.toThrow(/permission denied/);
    await expect(t.service(`delete from public.content_reviews`)).rejects.toThrow(
      /permission denied/
    );
    await expect(t.owner(`update public.content_reviews set notes = 'x'`)).rejects.toThrow(
      /can't be changed/
    );
  });

  it('judges and people without MFA see no review history', async () => {
    await review(EDITOR, 'sent_for_review');
    expect(await t.as(JUDGE, `select id from public.content_reviews`)).toEqual([]);
    expect(
      await t.as(REVIEWER, `select id from public.content_reviews`, [], { mfa: false })
    ).toEqual([]);
    expect(await t.as(EDITOR, `select id from public.content_reviews`)).toHaveLength(1);
  });
});
