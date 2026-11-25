// M5 step 8a (migration 0022): which school or club a certificate names, and checking a code.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const VERIFIER = '00000000-0000-4000-8000-000000000031';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const COACH = '00000000-0000-4000-8000-000000000012';
const PARENT = '00000000-0000-4000-8000-000000000021';
let t: TestDb;
let learner: string;
let school: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
const label = async () =>
  (await one(t.service<{ l: string }>(`select public.certificate_label($1) as l`, [learner]))).l;

async function orgWithClass(admin: string, kind: 'school' | 'club', name: string) {
  const { id: org } = await one(
    t.as<{ id: string }>(
      admin,
      kind === 'school'
        ? `select public.register_organisation('school', $1, null, '500123456', null) as id`
        : `select public.register_organisation('club', $1, null, null, 'NPO-123') as id`,
      [name]
    )
  );
  const { id: cls } = await one(
    t.as<{ id: string }>(admin, `select public.create_class($1, 'Robotics', '3-4', 'en') as id`, [
      org
    ])
  );
  const { enrol_token } = await one(
    t.as<{ enrol_token: string }>(admin, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  );
  return { org, token: enrol_token };
}

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [VERIFIER]: 'verifier@example.org',
    [TEACHER]: 'teacher@example.org',
    [COACH]: 'coach@example.org',
    [PARENT]: 'parent@example.org'
  });
  for (const u of [TEACHER, COACH, PARENT]) await t.as(u, `select public.touch_adult()`);
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await t.as(ROOT, `select public.grant_role($1, 'coach_verifier')`, [VERIFIER]);
  const s = await orgWithClass(TEACHER, 'school', 'Sizwe Primary');
  school = s.org;
  ({ id: learner } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'robot', 'en', '1.0') as id`,
      [s.token]
    )
  ));
});

describe('the certificate label (migration 0022)', () => {
  it('names the school, marked until it is verified', async () => {
    expect(await label()).toBe('Sizwe Primary (not yet verified)');
    await t.as(VERIFIER, `select public.verify_organisation($1, 'official_phone')`, [school]);
    expect(await label()).toBe('Sizwe Primary');
  });

  it('prefers the school or club whose teacher checked a record', async () => {
    const club = await orgWithClass(COACH, 'club', 'Robo Club');
    await t.as(PARENT, `select public.link_child($1, $2, '1.0')`, [club.token, learner]);
    // Newest class: the club.
    expect(await label()).toBe('Robo Club (not yet verified)');
    // The school's teacher checks a record: the school.
    const claims = JSON.stringify({
      role: 'authenticated',
      kind: 'learner',
      learner_id: learner,
      sv: 1
    });
    await t.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await t.db.exec('set role authenticated');
    await t.db.query(
      `insert into public.sheet_records (id, learner_id, lesson_id, sheet_code, steps_done, i_can,
         built_working, recorded_at)
       values ($1, $2, 'p1-crank-01', 'p1-crank-01-81feed', 9, array[true], true, now())`,
      ['c'.repeat(32), learner]
    );
    await t.db.exec('reset role');
    await t.as(TEACHER, `select public.check_record($1)`, ['c'.repeat(32)]);
    expect(await label()).toBe('Sizwe Primary (not yet verified)');
  });

  it('a code shows the badge, date and label to anyone, never a name; revoked codes say so', async () => {
    const { id: award } = await one(
      t.service<{ id: string }>(`select public.award_badge($1, 'first-build', '1') as id`, [
        learner
      ])
    );
    const { code } = await one(
      t.service<{ code: string }>(`select public.issue_certificate_code($1, $2) as code`, [
        award,
        await label()
      ])
    );
    expect(code).toMatch(/^RFA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
    await t.db.exec('set role anon');
    const shown = (
      await t.db.query(`select * from public.verify_certificate($1)`, [code.toLowerCase()])
    ).rows;
    await t.db.exec('reset role');
    expect(shown).toEqual([
      {
        badge_id: 'first-build',
        issued_on: expect.any(Date),
        issued_by_label: 'Sizwe Primary (not yet verified)',
        valid: true
      }
    ]);
    expect(JSON.stringify(shown)).not.toContain('Thandi');
    await t.as(TEACHER, `select public.revoke_badge($1)`, [award]);
    const after = await t.service<{ valid: boolean }>(
      `select valid from public.verify_certificate($1)`,
      [code]
    );
    expect(after).toEqual([{ valid: false }]);
  });
});
