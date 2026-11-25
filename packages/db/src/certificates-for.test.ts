// M5 step 8b (migration 0023): who may print which certificate, and when the name comes with it.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const TEACHER = '00000000-0000-4000-8000-000000000011';
const OTHER_TEACHER = '00000000-0000-4000-8000-000000000012';
const PARENT = '00000000-0000-4000-8000-000000000021';
const STRANGER = '00000000-0000-4000-8000-000000000022';
const NAME = Buffer.from([1, 2, 3]);
let t: TestDb;
let cls: string;
let learner: string;
let award: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
const forAward = (by: string) =>
  t.service<{ badge_id: string; certificate_name: Buffer | null }>(
    `select badge_id, certificate_name from public.certificates_for($1, $2)`,
    [by, award]
  );

beforeEach(async () => {
  t = await TestDb.create({
    [TEACHER]: 'teacher@example.org',
    [OTHER_TEACHER]: 'other@example.org',
    [PARENT]: 'parent@example.org',
    [STRANGER]: 'stranger@example.org'
  });
  for (const u of [TEACHER, OTHER_TEACHER, PARENT, STRANGER])
    await t.as(u, `select public.touch_adult()`);
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
  const { enrol_token } = await one(
    t.as<{ enrol_token: string }>(TEACHER, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  );
  ({ id: learner } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'robot', 'zu', '1.0') as id`,
      [enrol_token]
    )
  ));
  ({ id: award } = await one(
    t.service<{ id: string }>(`select public.award_badge($1, 'first-build', '1') as id`, [learner])
  ));
});

describe('certificates for (migration 0023)', () => {
  it('the parent and the class’s teacher may print; others get nothing', async () => {
    expect((await forAward(PARENT)).map((r) => r.badge_id)).toEqual(['first-build']);
    expect((await forAward(TEACHER)).map((r) => r.badge_id)).toEqual(['first-build']);
    expect(await forAward(STRANGER)).toEqual([]);
    expect(await forAward(OTHER_TEACHER)).toEqual([]);
  });

  it('the encrypted name comes only with the name consent', async () => {
    expect((await forAward(PARENT))[0]?.certificate_name).toBeNull();
    await t.service(`select public.set_certificate_name($1, $2, $3, 1, '1.0')`, [
      learner,
      PARENT,
      NAME
    ]);
    expect([...((await forAward(PARENT))[0]?.certificate_name ?? [])]).toEqual([1, 2, 3]);
    await t.as(PARENT, `select public.withdraw_consent($1, 'name')`, [learner]);
    expect((await forAward(PARENT))[0]?.certificate_name).toBeNull();
  });

  it('a class batch is for its own staff, one badge or all; revoked badges never', async () => {
    const batch = (by: string, badge: string | null = null) =>
      t.service<{ badge_id: string; language: string }>(
        `select badge_id, language from public.certificates_for($1, null, $2, $3)`,
        [by, cls, badge]
      );
    expect(await batch(TEACHER)).toEqual([{ badge_id: 'first-build', language: 'zu' }]);
    expect(await batch(TEACHER, 'lever-master')).toEqual([]);
    await expect(batch(OTHER_TEACHER)).rejects.toThrow(/only the class/);
    await t.as(TEACHER, `select public.revoke_badge($1)`, [award]);
    expect(await batch(TEACHER)).toEqual([]);
    await expect(
      t.as(TEACHER, `select * from public.certificates_for($1, $2)`, [TEACHER, award])
    ).rejects.toThrow(/permission denied/);
  });
});
