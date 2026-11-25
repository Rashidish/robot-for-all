// M5 step 4e part 2 (migration 0016): what the daily job reads and records.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const TEACHER = '00000000-0000-4000-8000-000000000011';
const PARENT = '00000000-0000-4000-8000-000000000021';
let t: TestDb;
let cls: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

beforeEach(async () => {
  t = await TestDb.create({ [TEACHER]: 'teacher@example.org', [PARENT]: 'parent@example.org' });
  await t.as(TEACHER, `select public.touch_adult()`);
  await t.as(PARENT, `select public.touch_adult()`);
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
});

describe('the daily job (migration 0016)', () => {
  it('reminds a waiting enrolment twice, on days 5 and 10', async () => {
    const { id } = await one(
      t.service<{ id: string }>(
        `select public.create_pending_enrolment($1, $2, 4, $3, 1, $4, 1, $5) as id`,
        [cls, TEACHER, Buffer.from([1]), Buffer.from([2]), 'c'.repeat(64)]
      )
    );
    await t.service(`select public.store_pending_token($1, $2, 1)`, [id, Buffer.from([3])]);
    const due = () => t.service<{ id: string }>(`select id from public.pending_reminders_due()`);
    expect(await due()).toEqual([]);
    await t.owner(
      `update public.pending_enrolments set requested_at = now() - interval '5 days 1 hour'`
    );
    expect(await due()).toEqual([{ id }]);
    await t.service(`select public.pending_reminder_sent($1)`, [id]);
    expect(await due()).toEqual([]);
    await t.owner(
      `update public.pending_enrolments set requested_at = now() - interval '10 days 1 hour'`
    );
    expect(await due()).toEqual([{ id }]);
    await t.service(`select public.pending_reminder_sent($1)`, [id]);
    await t.owner(`update public.pending_enrolments set requested_at = now() - interval '13 days'`);
    expect(await due()).toEqual([]);
  });

  it('gives dormancy warnings with the adult’s own email, not once due for deletion', async () => {
    await t.owner(
      `update public.adults set last_seen_at = now() - interval '10 months 1 day' where user_id = $1`,
      [PARENT]
    );
    expect(await t.service(`select months, email from public.dormancy_warnings_due()`)).toEqual([
      { months: 10, email: 'parent@example.org' }
    ]);
    await t.owner(`update public.adults set deletion_due_at = now() where user_id = $1`, [PARENT]);
    expect(await t.service(`select * from public.dormancy_warnings_due()`)).toEqual([]);
  });

  it('runs the weekly notice at most every 7 days', async () => {
    const due = async () =>
      (
        await one(
          t.service<{ d: boolean }>(`select public.job_due('privacy_notice', '7 days') as d`)
        )
      ).d;
    expect(await due()).toBe(true);
    expect(await due()).toBe(false);
    await t.owner(`update public.job_runs set last_at = now() - interval '7 days 1 minute'`);
    expect(await due()).toBe(true);
  });

  it('is for the service only', async () => {
    await expect(t.as(TEACHER, `select * from public.pending_reminders_due()`)).rejects.toThrow(
      /permission denied/
    );
    await expect(t.as(TEACHER, `select * from public.dormancy_warnings_due()`)).rejects.toThrow(
      /permission denied/
    );
  });
});
