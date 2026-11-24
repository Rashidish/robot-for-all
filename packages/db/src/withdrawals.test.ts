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
    ).rejects.toThrow(/reviews are for lessons, worlds/);
  });
});

describe('the languages each person reads (migration 0007)', () => {
  it('people set their own languages; codes are cleaned and checked', async () => {
    await t.as(REVIEWER, `select public.set_reviewer_languages($1)`, [[' ZU', 'en', 'zu', '']]);
    const [row] = await t.as<{ languages: string[] }>(
      REVIEWER,
      `select languages from public.admin_profiles where user_id = $1`,
      [REVIEWER]
    );
    expect(row?.languages).toEqual(['en', 'zu']);
    const reads = async (code: string) =>
      (await t.as<{ ok: boolean }>(REVIEWER, `select public.reads_language($1) as ok`, [code]))[0]
        ?.ok;
    expect(await reads('zu')).toBe(true);
    expect(await reads('xh')).toBe(false);
    await expect(
      t.as(REVIEWER, `select public.set_reviewer_languages($1)`, [['isiZulu']])
    ).rejects.toThrow(/language codes/);
  });

  it('needs a reviewer name first, and MFA', async () => {
    await expect(
      t.as(EDITOR, `select public.set_reviewer_languages($1)`, [['zu']])
    ).rejects.toThrow(/reviewer name first/);
    await expect(
      t.as(REVIEWER, `select public.set_reviewer_languages($1)`, [['zu']], { mfa: false })
    ).rejects.toThrow(/only back-office users/);
  });
});

describe('languages are reviewed by someone who reads them (migration 0008)', () => {
  const TICKS = {
    meaning_kept: true,
    safety_exact: true,
    child_words: true,
    local_terms: true,
    no_english_left: true
  };
  const review = (
    user: string,
    decision: string,
    checklist: unknown = null,
    notes: string | null = null
  ) =>
    t.as(user, `select public.record_review('language', 'zu', $1, $2, $3, $4)`, [
      decision,
      checklist,
      notes,
      PR
    ]);

  it('a translator sends isiZulu for review; only a reviewer who reads isiZulu approves it', async () => {
    const TRANSLATOR = EDITOR;
    await t.as(ROOT, `select public.grant_role($1, 'translator')`, [TRANSLATOR]);
    await review(TRANSLATOR, 'sent_for_review');
    await expect(review(REVIEWER, 'approved', TICKS)).rejects.toThrow(/reads this language/);
    await t.as(REVIEWER, `select public.set_reviewer_languages($1)`, [['zu']]);
    await expect(review(REVIEWER, 'approved', { ...TICKS, safety_exact: false })).rejects.toThrow(
      /missing: safety_exact/
    );
    await review(REVIEWER, 'approved', TICKS);
  });

  it('a language has no build test', async () => {
    await expect(review(REVIEWER, 'build_tested', null, 'Built it on the floor')).rejects.toThrow(
      /no build test/
    );
  });
});

describe('lesson translations are reviewed by someone who reads the language (migration 0009)', () => {
  const TICKS = {
    meaning_kept: true,
    safety_exact: true,
    child_words: true,
    local_terms: true,
    no_english_left: true,
    ai_read: true
  };
  const review = (
    user: string,
    decision: string,
    checklist: unknown = null,
    id = 'p1-crank-01/zu',
    notes: string | null = null
  ) =>
    t.as(user, `select public.record_review('translation', $1, $2, $3, $4, $5)`, [
      id,
      decision,
      checklist,
      notes,
      PR
    ]);

  it('a translator sends it; only a reviewer who reads isiZulu approves, with all six ticks', async () => {
    const TRANSLATOR = EDITOR;
    await t.as(ROOT, `select public.grant_role($1, 'translator')`, [TRANSLATOR]);
    await review(TRANSLATOR, 'sent_for_review');
    await expect(review(REVIEWER, 'approved', TICKS)).rejects.toThrow(/reads this language/);
    await t.as(REVIEWER, `select public.set_reviewer_languages($1)`, [['zu']]);
    await expect(review(REVIEWER, 'approved', { ...TICKS, ai_read: false })).rejects.toThrow(
      /missing: ai_read/
    );
    await review(REVIEWER, 'approved', TICKS);
    const [row] = await t.service<{ n: number }>(
      `select count(*)::int as n from public.content_reviews where content_type = 'translation' and content_id = 'p1-crank-01/zu'`
    );
    expect(row?.n).toBe(2);
  });

  it('refuses a build test, an English "translation" and a malformed id', async () => {
    await t.as(REVIEWER, `select public.set_reviewer_languages($1)`, [['zu', 'en']]);
    await expect(
      review(REVIEWER, 'build_tested', null, 'p1-crank-01/zu', 'Built it from the lesson')
    ).rejects.toThrow(/no build test/);
    await expect(review(REVIEWER, 'approved', TICKS, 'p1-crank-01/en')).rejects.toThrow(
      /<lesson>\/<language>/
    );
    await expect(review(REVIEWER, 'approved', TICKS, 'p1-crank-01')).rejects.toThrow(
      /<lesson>\/<language>/
    );
  });

  it('a translator cannot approve, even one who reads the language', async () => {
    await t.as(ROOT, `select public.grant_role($1, 'translator')`, [EDITOR]);
    await t.as(EDITOR, `select public.set_reviewer_name($1)`, ['Editor 4']);
    await expect(review(EDITOR, 'approved', TICKS)).rejects.toThrow(/reads this language|reviewer/);
  });
});
