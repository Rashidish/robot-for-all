// M5 step 4b (migration 0014): a school enrols a learner for the parent to confirm.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const TEACHER = '00000000-0000-4000-8000-000000000011';
const OTHER_TEACHER = '00000000-0000-4000-8000-000000000012';
const PARENT = '00000000-0000-4000-8000-000000000021';
const HASH = 'a'.repeat(64);
let t: TestDb;
let cls: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

const request = async (hash = HASH) =>
  (
    await one(
      t.service<{ id: string }>(
        `select public.create_pending_enrolment($1, $2, 4, $3, 1, $4, 1, $5) as id`,
        [cls, TEACHER, Buffer.from([1, 2, 3]), Buffer.from([4, 5, 6]), hash]
      )
    )
  ).id;

beforeEach(async () => {
  t = await TestDb.create({
    [TEACHER]: 'teacher@example.org',
    [OTHER_TEACHER]: 'other@example.org',
    [PARENT]: 'parent@example.org'
  });
  for (const u of [TEACHER, OTHER_TEACHER, PARENT]) await t.as(u, `select public.touch_adult()`);
  const { id: org } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  );
  ({ id: cls } = await one(
    t.as<{ id: string }>(TEACHER, `select public.create_class($1, 'Grade 4B', '3-4', 'zu') as id`, [
      org
    ])
  ));
});

describe('school enrolment helpers (migration 0014)', () => {
  it('labels a class and finds a waiting enrolment by its hash', async () => {
    expect(await t.service(`select * from public.class_label($1)`, [cls])).toEqual([
      { class_name: 'Grade 4B', organisation_name: 'Sizwe Primary', language: 'zu' }
    ]);
    const id = await request();
    const found = await one(
      t.service<{ id: string; class_name: string; grade: number }>(
        `select id, class_name, grade from public.pending_for_token($1)`,
        [HASH]
      )
    );
    expect(found).toEqual({ id, class_name: 'Grade 4B', grade: 4 });
    expect(await t.service(`select * from public.pending_for_token($1)`, ['b'.repeat(64)])).toEqual(
      []
    );
    // Expired ones are not found.
    await t.owner(`update public.pending_enrolments set expires_at = now() - interval '1 second'`);
    expect(await t.service(`select * from public.pending_for_token($1)`, [HASH])).toEqual([]);
  });

  it('the parent confirms as themselves; the waiting entry goes', async () => {
    await request();
    const token = 'secret';
    await t.owner(`update public.pending_enrolments set confirm_token_hash = $1`, [
      Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString(
        'hex'
      )
    ]);
    const { id } = await one(
      t.as<{ id: string }>(
        PARENT,
        `select public.confirm_enrolment($1, 'Thandi R', 'robot', 'zu', '1.0', false) as id`,
        [token]
      )
    );
    expect(await t.as(PARENT, `select nickname from public.learners where id = $1`, [id])).toEqual([
      { nickname: 'Thandi R' }
    ]);
    expect(await t.owner(`select id from public.pending_enrolments`)).toEqual([]);
  });

  it('only the class’s staff can withdraw a request; browsers cannot use the service helpers', async () => {
    const id = await request();
    await expect(
      t.as(OTHER_TEACHER, `select public.cancel_pending_enrolment($1)`, [id])
    ).rejects.toThrow(/only the class/);
    await expect(
      t.as(TEACHER, `select * from public.pending_for_token($1)`, [HASH])
    ).rejects.toThrow(/permission denied/);
    await expect(t.as(TEACHER, `select public.drop_pending_enrolment($1)`, [id])).rejects.toThrow(
      /permission denied/
    );
    await t.as(TEACHER, `select public.cancel_pending_enrolment($1)`, [id]);
    expect(await t.owner(`select id from public.pending_enrolments`)).toEqual([]);
  });
});
