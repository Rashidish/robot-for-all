// M5 step 4d (migration 0013): the certificate service shows a class's names to its own staff
// at a verified school or club, only with all three consents, and logs each reveal.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const OTHER_TEACHER = '00000000-0000-4000-8000-000000000012';
const PARENT = '00000000-0000-4000-8000-000000000021';
const VERIFIER = '00000000-0000-4000-8000-000000000031';
const NAME = Buffer.from([1, 2, 3, 4, 5]);
let t: TestDb;
let org: string;
let cls: string;
let token: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

async function enrolWithName(nickname: string) {
  const { id } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, $2, 4, 'robot', 'en', '1.0') as id`,
      [token, nickname]
    )
  );
  await t.service(`select public.set_certificate_name($1, $2, $3, 1, '1.0')`, [id, PARENT, NAME]);
  return id;
}

const reveal = (by = TEACHER) =>
  t.service<{ learner_id: string; key_version: number }>(
    `select learner_id, key_version from public.reveal_class_names($1, $2)`,
    [cls, by]
  );

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [TEACHER]: 'teacher@example.org',
    [OTHER_TEACHER]: 'other@example.org',
    [PARENT]: 'parent@example.org',
    [VERIFIER]: 'verifier@example.org'
  });
  for (const u of [TEACHER, OTHER_TEACHER, PARENT]) await t.as(u, `select public.touch_adult()`);
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await t.as(ROOT, `select public.grant_role($1, 'coach_verifier')`, [VERIFIER]);
  ({ id: org } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  ));
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

describe('show names (migration 0013)', () => {
  it('waits until the school or club is verified', async () => {
    await enrolWithName('Thandi R');
    await expect(reveal()).rejects.toThrow(/verified/);
  });

  it("returns only this class's consented names to its staff, and logs the count", async () => {
    await t.as(VERIFIER, `select public.verify_organisation($1, 'official_phone')`, [org]);
    const thandi = await enrolWithName('Thandi R');
    const sipho = await enrolWithName('Sipho M');
    // Sipho's parent removes the name: it is no longer shown.
    await t.as(PARENT, `select public.withdraw_consent($1, 'name')`, [sipho]);
    expect(await reveal()).toEqual([{ learner_id: thandi, key_version: 1 }]);
    const log = await t.owner<{ names_shown: number; user_id: string }>(
      `select names_shown, user_id from public.name_reveals`
    );
    expect(log).toEqual([{ names_shown: 1, user_id: TEACHER }]);
    expect(
      Object.keys((await t.owner(`select * from public.name_reveals`))[0] ?? {})
    ).not.toContain('certificate_name');
  });

  it('refuses other teachers, and is not callable from a browser session', async () => {
    await t.as(VERIFIER, `select public.verify_organisation($1, 'official_phone')`, [org]);
    await enrolWithName('Thandi R');
    await expect(reveal(OTHER_TEACHER)).rejects.toThrow(/only the class/);
    await expect(
      t.as(TEACHER, `select * from public.reveal_class_names($1, $2)`, [cls, TEACHER])
    ).rejects.toThrow(/permission denied/);
    // Teachers cannot read the reveal log either.
    expect(await t.as(TEACHER, `select * from public.name_reveals`)).toEqual([]);
  });
});
