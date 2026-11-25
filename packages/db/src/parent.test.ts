// M5 step 4c (migration 0012): a parent sees their own children's classes, and nobody else's.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

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

const enrol = async (nickname: string, parent: string) =>
  (
    await one(
      t.as<{ id: string }>(
        parent,
        `select public.enrol_child($1, $2, 4, 'robot', 'en', '1.0') as id`,
        [token, nickname]
      )
    )
  ).id;

beforeEach(async () => {
  t = await TestDb.create({
    [TEACHER]: 'teacher@example.org',
    [PARENT]: 'parent@example.org',
    [OTHER_PARENT]: 'other@example.org'
  });
  for (const u of [TEACHER, PARENT, OTHER_PARENT]) await t.as(u, `select public.touch_adult()`);
  const { id: org } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  );
  ({ id: cls } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.create_class($1, 'Grade 4B Robotics', '3-4', 'en') as id`,
      [org]
    )
  ));
  ({ enrol_token: token } = await one(
    t.as<{ enrol_token: string }>(TEACHER, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  ));
});

describe("a parent's view of their children (migration 0012)", () => {
  it('lists only their own children with class and school names', async () => {
    const mine = await enrol('Thandi R', PARENT);
    await enrol('Sipho M', OTHER_PARENT);
    const rows = await t.as(PARENT, `select * from public.my_children_classes()`);
    expect(rows).toEqual([
      {
        learner_id: mine,
        class_id: cls,
        class_name: 'Grade 4B Robotics',
        organisation_name: 'Sizwe Primary'
      }
    ]);
    // Still no direct read of the class (its codes stay with staff).
    expect(await t.as(PARENT, `select id from public.classes`)).toEqual([]);
  });

  it('shows nothing once the child leaves the class or is deleted', async () => {
    const mine = await enrol('Thandi R', PARENT);
    await t.as(PARENT, `select public.withdraw_consent($1, 'class', $2)`, [mine, cls]);
    expect(await t.as(PARENT, `select * from public.my_children_classes()`)).toEqual([]);
    await t.as(PARENT, `select public.delete_learner($1)`, [mine]);
    expect(await t.as(PARENT, `select id from public.learners`)).toEqual([]);
  });

  it('the anonymous key cannot call it', async () => {
    await t.db.exec('set role anon');
    try {
      await expect(t.db.query(`select * from public.my_children_classes()`)).rejects.toThrow(
        /permission denied/
      );
    } finally {
      await t.db.exec('reset role');
    }
  });
});
