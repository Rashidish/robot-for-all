// Withdraw / restore (migration 0005; more content spec §2.4) and the seventh review tick.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const REVIEWER = '00000000-0000-4000-8000-000000000002';
const MANAGER = '00000000-0000-4000-8000-000000000003';
const EDITOR = '00000000-0000-4000-8000-000000000004';
const PR = 'https://github.com/Rashidish/robots-for-all/pull/201';
const SIX = {
  safety: true,
  electrical: true,
  age_language: true,
  caps: true,
  parts_cost: true,
  ai_read: true
};

let t: TestDb;
const withdraw = (
  user: string,
  type: string,
  id: string,
  decision = 'withdrawn',
  reason = 'Wrong fold line on the leg'
) =>
  t.as(user, `select public.record_withdrawal($1, $2, $3, $4, $5)`, [
    type,
    id,
    decision,
    reason,
    PR
  ]);

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [REVIEWER]: 'reviewer@example.org',
    [MANAGER]: 'manager@example.org',
    [EDITOR]: 'editor@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  for (const [user, role] of [
    [REVIEWER, 'reviewer'],
    [MANAGER, 'competition_manager'],
    [EDITOR, 'content_editor']
  ] as const) {
    await t.as(ROOT, `select public.grant_role($1, $2)`, [user, role]);
  }
  await t.as(REVIEWER, `select public.set_reviewer_name($1)`, ['Reviewer 3']);
});

describe('withdraw and restore', () => {
  it('reviewers withdraw and restore any content type, with a reason, recorded and audited', async () => {
    for (const [type, id] of [
      ['lesson', 'p2-art-01'],
      ['template', 'p1-crank-01/rhino-parts'],
      ['world', 'bump-maze'],
      ['season', 'rhino-patrol'],
      ['language', 'zu']
    ]) {
      await withdraw(REVIEWER, type ?? '', id ?? '');
    }
    await withdraw(
      REVIEWER,
      'template',
      'p1-crank-01/rhino-parts',
      'restored',
      'Fold line fixed and checked'
    );
    const rows = await t.as<{ content_type: string; decision: string; reviewer_name: string }>(
      REVIEWER,
      `select content_type, decision, reviewer_name from public.content_reviews order by id`
    );
    expect(rows.map((r) => `${r.content_type}:${r.decision}`)).toEqual([
      'lesson:withdrawn',
      'template:withdrawn',
      'world:withdrawn',
      'season:withdrawn',
      'language:withdrawn',
      'template:restored'
    ]);
    expect(rows.every((r) => r.reviewer_name === 'Reviewer 3')).toBe(true);
    const log = await t.owner<{ action: string }>(
      `select action from public.audit_log where action like 'content.%' order by id`
    );
    expect(log).toHaveLength(6);
  });

  it('competition managers withdraw worlds and seasons only', async () => {
    await withdraw(MANAGER, 'world', 'bump-maze');
    await withdraw(MANAGER, 'season', 'rhino-patrol');
    await expect(withdraw(MANAGER, 'lesson', 'p2-art-01')).rejects.toThrow(
      /only an owner or reviewer/
    );
    expect(await t.as(MANAGER, `select id from public.content_reviews`)).toHaveLength(2);
  });

  it("editors can't withdraw; a reason is required; MFA is required", async () => {
    await expect(withdraw(EDITOR, 'lesson', 'p2-art-01')).rejects.toThrow(
      /only an owner or reviewer/
    );
    await expect(withdraw(REVIEWER, 'lesson', 'p2-art-01', 'withdrawn', 'bad')).rejects.toThrow(
      /at least 10/
    );
    await expect(
      t.as(
        REVIEWER,
        `select public.record_withdrawal('lesson', 'p2-art-01', 'withdrawn', $1, $2)`,
        ['A good long reason', PR],
        { mfa: false }
      )
    ).rejects.toThrow(/only an owner or reviewer/);
    await expect(withdraw(REVIEWER, 'lesson', 'p2-art-01', 'approved')).rejects.toThrow(
      /use record_review/
    );
  });

  it('a withdrawal lets its own pull request merge (ADR-0012 condition 4)', async () => {
    await withdraw(REVIEWER, 'world', 'bump-maze');
    const [row] = await t.as<{ ok: boolean }>(
      REVIEWER,
      `select public.approved_pull_request($1) as ok`,
      [PR]
    );
    expect(row?.ok).toBe(true);
  });
});

describe('the seventh tick: templates', () => {
  it('approving a lesson now needs the templates tick too', async () => {
    await expect(
      t.as(
        REVIEWER,
        `select public.record_review('lesson', 'p2-art-01', 'approved', $1, null, $2)`,
        [SIX, PR]
      )
    ).rejects.toThrow(/missing: templates/);
    await t.as(
      REVIEWER,
      `select public.record_review('lesson', 'p2-art-01', 'approved', $1, null, $2)`,
      [{ ...SIX, templates: true }, PR]
    );
  });
});

describe('worlds have their own checklist (migration 0006)', () => {
  const WORLD = {
    challenge_clear: true,
    can_finish: true,
    fair_points: true,
    fits_floor: true,
    child_theme: true
  };
  it('approving a world needs the world ticks, not the lesson ones', async () => {
    await expect(
      t.as(
        REVIEWER,
        `select public.record_review('world', 'bump-maze', 'approved', $1, null, $2)`,
        [{ ...SIX, templates: true }, PR]
      )
    ).rejects.toThrow(/missing: challenge_clear/);
    await t.as(
      REVIEWER,
      `select public.record_review('world', 'bump-maze', 'approved', $1, null, $2)`,
      [WORLD, PR]
    );
    await expect(
      t.as(
        REVIEWER,
        `select public.record_review('season', 'rhino-patrol', 'approved', $1, null, $2)`,
        [WORLD, PR]
      )
    ).rejects.toThrow(/lessons and worlds/);
  });
});
