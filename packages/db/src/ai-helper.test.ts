// The AI helper (migration 0028; M6 spec v0.3): who may ask, caps, consent (e), the class switch,
// the platform's month, Common questions and their thumbs-down, and the back-office settings.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const PARENT = '00000000-0000-4000-8000-000000000021';
const STRANGER = '00000000-0000-4000-8000-000000000022';
let t: TestDb;
let cls: string;
let kid: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
interface Take {
  allowed: boolean;
  reason: string | null;
  audience: string;
  grade_band: string | null;
  names: string[] | null;
}
const take = (adult: string | null, learner: string | null, onLesson = true) =>
  one(t.service<Take>(`select * from public.helper_take($1, $2, $3)`, [adult, learner, onLesson]));
const settings = (changes: Record<string, unknown>) =>
  t.as(ROOT, `select public.helper_settings_update($1::jsonb)`, [JSON.stringify(changes)]);

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [OWNER]: 'owner@example.org',
    [TEACHER]: 'teacher@example.org',
    [PARENT]: 'parent@example.org',
    [STRANGER]: 'stranger@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await t.as(ROOT, `select public.grant_role($1, 'owner')`, [OWNER]);
  for (const u of [TEACHER, PARENT, STRANGER]) await t.as(u, `select public.touch_adult()`);
  const { id: org } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  );
  ({ id: cls } = await one(
    t.as<{ id: string }>(TEACHER, `select public.create_class($1, 'Grade 4B', '3-4', 'en') as id`, [
      org
    ])
  ));
  const { enrol_token } = await one(
    t.owner<{ enrol_token: string }>(`select enrol_token from public.classes where id = $1`, [cls])
  );
  ({ id: kid } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'robot', 'en', '1.0') as id`,
      [enrol_token]
    )
  ));
});

describe('asking (migration 0028)', () => {
  it('is off until the owner switches it on; adults then get 20 a day', async () => {
    expect(await take(TEACHER, null)).toMatchObject({ allowed: false, reason: 'off' });
    await settings({ enabled: true });
    const first = await take(TEACHER, null, false);
    expect(first).toMatchObject({ allowed: true, audience: 'adult', grade_band: null });
    // The teacher's class's nicknames are stripped from their questions.
    expect(first.names).toEqual(['Thandi R']);
    expect((await take(PARENT, null)).names).toEqual(['Thandi R']);
    expect((await take(STRANGER, null)).names).toEqual([]);
    for (let i = 1; i < 20; i++) await take(TEACHER, null);
    expect(await take(TEACHER, null)).toMatchObject({ allowed: false, reason: 'daily_cap' });
    // Tomorrow it works again.
    await t.owner(`update public.helper_usage set day = day - 1`);
    expect((await take(TEACHER, null)).allowed).toBe(true);
  });

  it('a child asks only on lesson pages, with the parent’s consent and no class switched off', async () => {
    await settings({ enabled: true });
    expect(await take(null, kid)).toMatchObject({ reason: 'children_off' });
    await settings({ children_enabled: true, class_daily_per_learner: 50 });
    expect(await take(null, kid)).toMatchObject({ reason: 'no_consent' });
    // Only the child's own parent can turn it on.
    await expect(
      t.as(STRANGER, `select public.set_helper_consent($1, true, '1.1')`, [kid])
    ).rejects.toThrow(/parent or guardian/);
    await t.as(PARENT, `select public.set_helper_consent($1, true, '1.1')`, [kid]);
    expect(await t.as(PARENT, `select * from public.my_children_helper()`)).toEqual([
      { learner_id: kid, helper_on: true }
    ]);
    expect(await take(null, kid, false)).toMatchObject({ reason: 'lesson_only' });
    const ok = await take(null, kid);
    expect(ok).toMatchObject({ allowed: true, audience: 'child', grade_band: '3-4' });
    expect(ok.names).toEqual(['Thandi R']);
    // The teacher switches it off for the class: off at once.
    await expect(
      t.as(PARENT, `select public.set_helper_allowed($1, false)`, [cls])
    ).rejects.toThrow(/teachers and coaches/);
    await t.as(TEACHER, `select public.set_helper_allowed($1, false)`, [cls]);
    expect(await take(null, kid)).toMatchObject({ reason: 'class_off' });
    await t.as(TEACHER, `select public.set_helper_allowed($1, true)`, [cls]);
    // Withdrawn by the parent: off at once.
    await t.as(PARENT, `select public.set_helper_consent($1, false, null)`, [kid]);
    expect(await take(null, kid)).toMatchObject({ reason: 'no_consent' });
    await t.as(PARENT, `select public.set_helper_consent($1, true, '1.1')`, [kid]);
    // Five a day for a child (one used above), and the class's count is a number only.
    for (let i = 1; i < 5; i++) await take(null, kid);
    expect(await take(null, kid)).toMatchObject({ reason: 'daily_cap' });
    expect(await t.as(TEACHER, `select public.class_helper_count($1) as n`, [cls])).toEqual([
      { n: 5 }
    ]);
    await expect(t.as(PARENT, `select public.class_helper_count($1)`, [cls])).rejects.toThrow(
      /teachers and coaches/
    );
  });

  it('a class has its own cap: 5 per learner a day', async () => {
    await settings({ enabled: true, children_enabled: true, child_daily: 50 });
    await t.as(PARENT, `select public.set_helper_consent($1, true, '1.1')`, [kid]);
    for (let i = 0; i < 5; i++) expect((await take(null, kid)).allowed).toBe(true);
    expect(await take(null, kid)).toMatchObject({ reason: 'class_cap' });
  });

  it('three refusals in a day pause the asker until tomorrow', async () => {
    await settings({ enabled: true });
    for (let i = 0; i < 3; i++) {
      await take(TEACHER, null);
      await t.service(`select public.helper_record($1, 'adult', true, false, 1)`, [TEACHER]);
    }
    expect(await take(TEACHER, null)).toMatchObject({ reason: 'paused' });
    expect((await take(PARENT, null)).allowed).toBe(true);
  });

  it('the platform stops at the month’s question cap or budget', async () => {
    await settings({ enabled: true, month_questions: 2 });
    await take(TEACHER, null);
    await take(PARENT, null);
    expect(await take(STRANGER, null)).toMatchObject({ reason: 'month_cap' });
    await settings({ month_questions: 100, month_budget_cents: 10 });
    await t.service(`select public.helper_record(null, 'faq', false, false, 10)`);
    expect(await take(STRANGER, null)).toMatchObject({ reason: 'budget' });
    expect(await t.service(`select * from public.helper_month_status()`)).toEqual([
      { questions: 2, spend_cents: 10, month_questions: 100, month_budget_cents: 10 }
    ]);
  });

  it('only the helper service may take or record; people can’t call it themselves', async () => {
    for (const sql of [
      `select * from public.helper_take(null, null, true)`,
      `select public.helper_record(null, 'adult', false, false, 1)`,
      `select * from public.helper_faq_for('p1-crank-01', 'en')`,
      `select * from public.helper_config()`
    ]) {
      await expect(t.as(TEACHER, sql)).rejects.toThrow(/permission denied/);
    }
    await expect(t.service(`select * from public.helper_take(null, null, true)`)).rejects.toThrow(
      /one asker/
    );
  });
});

describe('Common questions (migration 0028)', () => {
  const items = JSON.stringify([
    { q: 'Why does the jaw not close?', a: 'Check the straw is straight.' },
    { q: 'What if I have no straws?', a: 'Roll paper tightly.' }
  ]);

  it('are stored, served, and an answer with 3 thumbs-down is hidden until redrafted', async () => {
    await t.service(
      `select public.helper_faq_store('p1-crank-01', 'en', $1::jsonb, 'claude-haiku-5-5', 'faq-v1', 'abcd1234')`,
      [items]
    );
    const read = () => t.service(`select * from public.helper_faq_for('p1-crank-01', 'en')`);
    expect(await read()).toEqual([
      { item: 0, q: 'Why does the jaw not close?', a: 'Check the straw is straight.' },
      { item: 1, q: 'What if I have no straws?', a: 'Roll paper tightly.' }
    ]);
    const down = (who: string) =>
      one(
        t.service<{ hidden: boolean }>(
          `select public.helper_faq_down('p1-crank-01', 'en', 1, $1) as hidden`,
          [who]
        )
      );
    expect((await down(TEACHER)).hidden).toBe(false);
    expect((await down(TEACHER)).hidden).toBe(false); // one vote each
    expect((await down(PARENT)).hidden).toBe(false);
    expect((await down(kid)).hidden).toBe(true);
    expect((await read()).map((r) => r['item'])).toEqual([0]);
    expect(await t.service(`select * from public.helper_faq_state()`)).toEqual([
      {
        lesson_id: 'p1-crank-01',
        language: 'en',
        lesson_hash: 'abcd1234',
        prompt_version: 'faq-v1',
        hidden: 1
      }
    ]);
    // Redrafted: votes start again.
    await t.service(
      `select public.helper_faq_store('p1-crank-01', 'en', $1::jsonb, 'claude-haiku-5-5', 'faq-v1', 'abcd5678')`,
      [items]
    );
    expect(await read()).toHaveLength(2);
  });
});

describe('back office: helper settings and usage (migration 0028)', () => {
  it('only the owner changes settings, every change is audit-logged, and usage has no ids', async () => {
    await expect(settings({ nonsense: 1 })).rejects.toThrow(/unknown setting/);
    await t.as(OWNER, `select public.helper_settings_update('{"adult_daily": 10}'::jsonb)`);
    await expect(
      t.as(TEACHER, `select public.helper_settings_update('{"enabled": true}'::jsonb)`)
    ).rejects.toThrow(/only the owner/);
    expect(
      await t.as(OWNER, `select adult_daily, adult_model from public.helper_settings_read()`)
    ).toEqual([{ adult_daily: 10, adult_model: 'claude-haiku-5-5' }]);
    expect(
      await t.owner(
        `select after ->> 'adult_daily' as d from public.audit_log where action = 'helper.settings'`
      )
    ).toEqual([{ d: '10' }]);

    await settings({ enabled: true });
    await take(TEACHER, null);
    await t.service(`select public.helper_thumb('adult', false)`);
    const rows = await t.as(OWNER, `select * from public.helper_usage_totals(7)`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ audience: 'adult', asked: 1, thumbs_down: 1 });
    expect(Object.keys(rows[0] ?? {})).not.toContain('subject');
    await expect(t.as(TEACHER, `select * from public.helper_usage_totals(7)`)).rejects.toThrow(
      /only the owner/
    );
  });

  it('usage older than 31 days is deleted; a family group can’t be switched by staff', async () => {
    await settings({ enabled: true });
    await take(TEACHER, null);
    await t.owner(`update public.helper_usage set day = day - 40`);
    expect(await t.service(`select public.helper_cleanup() as n`)).toEqual([{ n: 1 }]);
    const { id: fam } = await one(
      t.as<{ id: string }>(PARENT, `select public.create_family_group('en') as id`)
    );
    await expect(
      t.as(PARENT, `select public.set_helper_allowed($1, false)`, [fam])
    ).rejects.toThrow(/family group follows/);
  });
});
