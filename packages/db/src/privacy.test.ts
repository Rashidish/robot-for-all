// M5 step 4e (migration 0015): dormant accounts are deleted only once confirmed in the back
// office; unconfirmed ones are locked for 30 days, then deleted. Spec v0.5 §7.5.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const DPO = '00000000-0000-4000-8000-000000000002';
const SUPPORT = '00000000-0000-4000-8000-000000000003';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const PARENT = '00000000-0000-4000-8000-000000000021';
const OTHER_PARENT = '00000000-0000-4000-8000-000000000022';
let t: TestDb;
let cls: string;
let token: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
const enrol = async (parent: string, nickname: string) =>
  (
    await one(
      t.as<{ id: string }>(
        parent,
        `select public.enrol_child($1, $2, 4, 'robot', 'en', '1.0') as id`,
        [token, nickname]
      )
    )
  ).id;
const age = (user: string, interval: string) =>
  t.owner(`update public.adults set last_seen_at = now() - $2::interval where user_id = $1`, [
    user,
    interval
  ]);

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [DPO]: 'dpo@example.org',
    [SUPPORT]: 'support@example.org',
    [TEACHER]: 'teacher@example.org',
    [PARENT]: 'parent@example.org',
    [OTHER_PARENT]: 'other@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await t.as(ROOT, `select public.grant_role($1, 'data_protection_officer')`, [DPO]);
  await t.as(ROOT, `select public.grant_role($1, 'support')`, [SUPPORT]);
  await t.as(TEACHER, `select public.touch_adult('Mr Khumalo')`);
  await t.as(PARENT, `select public.touch_adult('Mrs Dlamini')`);
  await t.as(OTHER_PARENT, `select public.touch_adult('Mr Zulu')`);
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
  ({ enrol_token: token } = await one(
    t.as<{ enrol_token: string }>(TEACHER, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  ));
});

describe('confirmed deletion of dormant accounts (migration 0015)', () => {
  it('lists due accounts by what they are linked to, without children’s names or contacts', async () => {
    await enrol(PARENT, 'Thandi R');
    await t.as(TEACHER, `select public.end_class($1)`, [cls]);
    await age(PARENT, '12 months 1 day');
    await age(TEACHER, '13 months');
    expect(await t.service(`select public.mark_due_for_deletion() as n`)).toEqual([{ n: 2 }]);
    const list = await t.as<Record<string, unknown>>(
      DPO,
      `select display_name, account_kind, linked_to, learners_to_go from public.deletion_due_list()`
    );
    expect(list).toEqual(
      expect.arrayContaining([
        {
          display_name: 'Mrs Dlamini',
          account_kind: 'parent',
          linked_to: 'Mrs Dlamini',
          learners_to_go: 1
        },
        {
          display_name: 'Mr Khumalo',
          account_kind: 'admin',
          linked_to: 'Sizwe Primary',
          learners_to_go: 0
        }
      ])
    );
    expect(JSON.stringify(list)).not.toMatch(/Thandi|@example/);
    // Only the data protection officer.
    await expect(t.as(SUPPORT, `select * from public.deletion_due_list()`)).rejects.toThrow(
      /data protection officer/
    );
  });

  it('confirming deletes the account and the child only they look after; logged as a count', async () => {
    const thandi = await enrol(PARENT, 'Thandi R');
    await t.as(TEACHER, `select public.end_class($1)`, [cls]);
    await age(PARENT, '12 months 1 day');
    await t.service(`select public.mark_due_for_deletion()`);
    // An account that is not due can't be deleted this way.
    expect(
      await t.as(DPO, `select public.confirm_deletions($1) as n`, [[PARENT, OTHER_PARENT]])
    ).toEqual([{ n: 1 }]);
    expect(await t.owner(`select 1 from auth.users where id = $1`, [PARENT])).toEqual([]);
    expect(await t.owner(`select 1 from auth.users where id = $1`, [OTHER_PARENT])).toHaveLength(1);
    expect(await t.owner(`select 1 from public.learners where id = $1`, [thandi])).toEqual([]);
    const log = await t.owner<{ action: string; after: unknown }>(
      `select action, after from public.audit_log where action like 'privacy.%'`
    );
    expect(log).toEqual([{ action: 'privacy.deletion_confirmed', after: { count: 1 } }]);
  });

  it('keeping an account needs a reason and starts the year again', async () => {
    await age(PARENT, '12 months 1 day');
    await t.service(`select public.mark_due_for_deletion()`);
    await expect(t.as(DPO, `select public.keep_account($1, 'no')`, [PARENT])).rejects.toThrow(
      /say why/
    );
    await t.as(DPO, `select public.keep_account($1, 'complaint under way')`, [PARENT]);
    expect(await t.as(DPO, `select * from public.deletion_due_list()`)).toEqual([]);
    const log = await one(
      t.owner<{ after: { reason: string } }>(
        `select after from public.audit_log where action = 'privacy.account_kept'`
      )
    );
    expect(log.after.reason).toBe('complaint under way');
  });

  it('unconfirmed for 30 days: locked for 30 days (no sign-in, learners out), then deleted', async () => {
    await enrol(PARENT, 'Thandi R');
    await age(PARENT, '12 months 1 day');
    await t.service(`select public.mark_due_for_deletion()`);
    // Not yet 30 days: nothing locked.
    expect(await t.service(`select public.lock_unconfirmed_deletions() as n`)).toEqual([{ n: 0 }]);
    await t.owner(
      `update public.adults set deletion_due_at = now() - interval '31 days' where user_id = $1`,
      [PARENT]
    );
    expect(await t.service(`select public.lock_unconfirmed_deletions() as n`)).toEqual([{ n: 1 }]);
    expect(await t.service(`select * from public.deletion_counts()`)).toEqual([
      { due: 0, waiting_over_7_days: 0, locked: 1 }
    ]);
    // Locked: the parent can't use the account, and the child can't sign in.
    await expect(t.as(PARENT, `select public.touch_adult()`)).rejects.toThrow(/locked/);
    const { class_code } = await one(
      t.as<{ class_code: string }>(TEACHER, `select class_code from public.classes`)
    );
    expect(await t.service(`select * from public.sign_in_roster($1)`, [class_code])).toEqual([]);
    // Lock not over yet: still there.
    expect(await t.service(`select public.delete_after_lock() as n`)).toEqual([{ n: 0 }]);
    await t.owner(
      `update public.adults set locked_until = now() - interval '1 second' where user_id = $1`,
      [PARENT]
    );
    expect(await t.service(`select public.delete_after_lock() as n`)).toEqual([{ n: 1 }]);
    expect(await t.owner(`select 1 from auth.users where id = $1`, [PARENT])).toEqual([]);
  });

  it('signing in before it is locked takes the account off the list', async () => {
    await age(PARENT, '12 months 1 day');
    await t.service(`select public.mark_due_for_deletion()`);
    await t.as(PARENT, `select public.touch_adult()`);
    expect(await t.service(`select * from public.deletion_counts()`)).toEqual([
      { due: 0, waiting_over_7_days: 0, locked: 0 }
    ]);
  });

  it('the job functions are for the service only', async () => {
    for (const fn of ['mark_due_for_deletion', 'lock_unconfirmed_deletions', 'delete_after_lock']) {
      await expect(t.as(DPO, `select public.${fn}()`)).rejects.toThrow(/permission denied/);
    }
    await expect(t.as(DPO, `select public.delete_adult_accounts($1)`, [[PARENT]])).rejects.toThrow(
      /permission denied/
    );
  });
});
