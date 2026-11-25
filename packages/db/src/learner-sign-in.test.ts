// M5 step 5a (migration 0017): what the sign-in service may read, first PINs, and signing a
// learner out everywhere.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const TEACHER = '00000000-0000-4000-8000-000000000011';
const PARENT = '00000000-0000-4000-8000-000000000021';
const STRANGER = '00000000-0000-4000-8000-000000000022';
let t: TestDb;
let code: string;
let learner: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

/** As a learner session, the way the sign-in service's token will look. */
async function asLearner<T = Record<string, unknown>>(id: string, sv: number, sql: string) {
  const claims = JSON.stringify({ role: 'authenticated', kind: 'learner', learner_id: id, sv });
  await t.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await t.db.exec('set role authenticated');
  try {
    return (await t.db.query<T>(sql)).rows;
  } finally {
    await t.db.exec('reset role');
    await t.db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

beforeEach(async () => {
  t = await TestDb.create({
    [TEACHER]: 'teacher@example.org',
    [PARENT]: 'parent@example.org',
    [STRANGER]: 'stranger@example.org'
  });
  for (const u of [TEACHER, PARENT, STRANGER]) await t.as(u, `select public.touch_adult()`);
  const { id: org } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  );
  const { id: cls } = await one(
    t.as<{ id: string }>(TEACHER, `select public.create_class($1, 'Grade 4B', '3-4', 'en') as id`, [
      org
    ])
  );
  const c = await one(
    t.as<{ enrol_token: string; class_code: string }>(
      TEACHER,
      `select enrol_token, class_code from public.classes where id = $1`,
      [cls]
    )
  );
  code = c.class_code;
  ({ id: learner } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'rocket', 'en', '1.0') as id`,
      [c.enrol_token]
    )
  ));
});

describe('learner sign-in (migration 0017)', () => {
  it('gives the service one learner of this class, and only them', async () => {
    const row = await one(
      t.service<{ nickname: string; pin_hash: string | null; session_version: number }>(
        `select nickname, pin_hash, session_version from public.learner_for_sign_in($1, $2)`,
        [code.toLowerCase(), learner]
      )
    );
    expect(row).toEqual({ nickname: 'Thandi R', pin_hash: null, session_version: 1 });
    expect(
      await t.service(`select * from public.learner_for_sign_in('ZZZZZZ', $1)`, [learner])
    ).toEqual([]);
    await expect(
      t.as(TEACHER, `select * from public.learner_for_sign_in($1, $2)`, [code, learner])
    ).rejects.toThrow(/permission denied/);
  });

  it('a first PIN can be chosen only once, until a reset', async () => {
    const choose = async (hash: string) =>
      (
        await one(
          t.service<{ ok: boolean }>(`select public.choose_learner_pin($1, $2) as ok`, [
            learner,
            hash
          ])
        )
      ).ok;
    expect(await choose('pbkdf2$1$a$b')).toBe(true);
    expect(await choose('pbkdf2$1$c$d')).toBe(false);
    await t.as(TEACHER, `select public.reset_learner_pin($1)`, [learner]);
    expect(await choose('pbkdf2$1$c$d')).toBe(true);
  });

  it('a learner session sees its own learner; "sign out everywhere" ends old sessions', async () => {
    expect(await asLearner(learner, 1, `select public.current_learner() as id`)).toEqual([
      { id: learner }
    ]);
    // A stranger can't; the parent can.
    await expect(
      t.as(STRANGER, `select public.revoke_learner_sessions($1)`, [learner])
    ).rejects.toThrow(/only the learner/);
    await t.as(PARENT, `select public.revoke_learner_sessions($1)`, [learner]);
    expect(await asLearner(learner, 1, `select public.current_learner() as id`)).toEqual([
      { id: null }
    ]);
    expect(await asLearner(learner, 2, `select public.current_learner() as id`)).toEqual([
      { id: learner }
    ]);
    // A token without a session version is never accepted.
    const claims = JSON.stringify({ role: 'authenticated', kind: 'learner', learner_id: learner });
    await t.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await t.db.exec('set role authenticated');
    const r = await t.db.query<{ id: string | null }>(`select public.current_learner() as id`);
    await t.db.exec('reset role');
    expect(r.rows).toEqual([{ id: null }]);
  });
});
