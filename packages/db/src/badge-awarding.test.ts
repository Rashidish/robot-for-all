// M5 step 7b (migration 0019): what the badge awarding reads.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const TEACHER = '00000000-0000-4000-8000-000000000011';
const PARENT = '00000000-0000-4000-8000-000000000021';
let t: TestDb;
let cls: string;
let learner: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

async function asLearner<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const claims = JSON.stringify({
    role: 'authenticated',
    kind: 'learner',
    learner_id: learner,
    sv: 1
  });
  await t.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await t.db.exec('set role authenticated');
  try {
    return (await t.db.query<T>(sql, params)).rows;
  } finally {
    await t.db.exec('reset role');
    await t.db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}
const record = (id: string) =>
  asLearner(
    `insert into public.sheet_records (id, learner_id, lesson_id, sheet_code, steps_done, i_can,
       built_working, recorded_at)
     values ($1, $2, 'p1-crank-01', 'p1-crank-01-81feed', 9, array[true, true], true, now())`,
    [id, learner]
  );

beforeEach(async () => {
  t = await TestDb.create({ [TEACHER]: 'teacher@example.org', [PARENT]: 'parent@example.org' });
  for (const u of [TEACHER, PARENT]) await t.as(u, `select public.touch_adult()`);
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
    t.as<{ enrol_token: string }>(TEACHER, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  );
  ({ id: learner } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'rocket', 'en', '1.0') as id`,
      [enrol_token]
    )
  ));
});

describe('badge awarding (migration 0019)', () => {
  it('a learner session learns who it is from the database', async () => {
    expect(await asLearner(`select public.whoami_learner() as id`)).toEqual([{ id: learner }]);
  });

  it('counts records that are not revoked; only checked ones where the class needs a check', async () => {
    await record('a'.repeat(32));
    await record('b'.repeat(32));
    await t.as(TEACHER, `select public.check_record($1, true)`, ['b'.repeat(32)]);
    const count = async () =>
      (await t.service(`select * from public.badge_records($1)`, [learner])).length;
    expect(await count()).toBe(1);
    await t.owner(`update public.classes set badges_need_check = true`);
    expect(await count()).toBe(0);
    await t.as(TEACHER, `select public.check_record($1)`, ['a'.repeat(32)]);
    expect(await count()).toBe(1);
    expect(await t.service(`select * from public.learners_with_new_records('1 day')`)).toEqual([
      { learner_id: learner }
    ]);
  });

  it('a badge is awarded once; the parent’s email comes with the nickname only', async () => {
    const award = async () =>
      (
        await one(
          t.service<{ id: string | null }>(
            `select public.award_badge($1, 'first-build', '1') as id`,
            [learner]
          )
        )
      ).id;
    expect(await award()).not.toBeNull();
    expect(await award()).toBeNull();
    expect(await t.service(`select * from public.learner_guardian_emails($1)`, [learner])).toEqual([
      { email: 'parent@example.org', nickname: 'Thandi R', language: 'en' }
    ]);
    await expect(
      t.as(TEACHER, `select * from public.badge_records($1)`, [learner])
    ).rejects.toThrow(/permission denied/);
  });
});

describe('badges need a check, and revoking a badge (migration 0021)', () => {
  it('a class’s teacher switches it; others can’t; a revoked badge stays revoked', async () => {
    await t.as(TEACHER, `select public.set_badges_need_check($1, true)`, [cls]);
    expect(
      await t.as(TEACHER, `select badges_need_check from public.classes where id = $1`, [cls])
    ).toEqual([{ badges_need_check: true }]);
    await expect(
      t.as(PARENT, `select public.set_badges_need_check($1, false)`, [cls])
    ).rejects.toThrow(/only the class/);

    const { id } = await one(
      t.service<{ id: string }>(`select public.award_badge($1, 'first-build', '1') as id`, [
        learner
      ])
    );
    await t.as(TEACHER, `select public.revoke_badge($1)`, [id]);
    const again = await one(
      t.service<{ id: string | null }>(`select public.award_badge($1, 'first-build', '1') as id`, [
        learner
      ])
    );
    expect(again.id).toBeNull();
    expect(
      await t.as(PARENT, `select revoked_at is not null as revoked from public.badge_awards`)
    ).toEqual([{ revoked: true }]);
  });
});
