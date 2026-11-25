// Family groups and personal learners (migration 0024; spec M5-family-and-personal v0.3).
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const MOM = '00000000-0000-4000-8000-000000000021';
const DAD = '00000000-0000-4000-8000-000000000022';
const STRANGER = '00000000-0000-4000-8000-000000000023';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const ADULT = '00000000-0000-4000-8000-000000000031';
let t: TestDb;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
const family = async (who = MOM) =>
  (await one(t.as<{ id: string }>(who, `select public.create_family_group('zu') as id`))).id;
const child = async (nickname: string, who = MOM) =>
  (
    await one(
      t.as<{ id: string }>(
        who,
        `select public.enrol_into_family($1, 4, 'robot', 'zu', '1.0') as id`,
        [nickname]
      )
    )
  ).id;

beforeEach(async () => {
  t = await TestDb.create({
    [MOM]: 'mom@example.org',
    [DAD]: 'dad@example.org',
    [STRANGER]: 'stranger@example.org',
    [TEACHER]: 'teacher@example.org',
    [ADULT]: 'adult@example.org'
  });
  for (const u of [MOM, DAD, STRANGER, TEACHER, ADULT])
    await t.as(u, `select public.touch_adult()`);
});

describe('family groups (migration 0024)', () => {
  it('a parent starts one (once), adds their children; no enrolment link, never verified', async () => {
    const cls = await family();
    expect(await family()).toBe(cls);
    await child('Thandi R');
    const c = await one(
      t.owner<{ enrol_open: boolean; kind: string }>(
        `select c.enrol_open, o.kind::text as kind from public.classes c
           join public.organisations o on o.id = c.organisation_id where c.id = $1`,
        [cls]
      )
    );
    expect(c).toEqual({ enrol_open: false, kind: 'family' });
    const { enrol_token } = await one(
      t.owner<{ enrol_token: string }>(`select enrol_token from public.classes where id = $1`, [
        cls
      ])
    );
    await expect(
      t.as(STRANGER, `select public.enrol_child($1, 'Other', 4, 'robot', 'en', '1.0')`, [
        enrol_token
      ])
    ).rejects.toThrow(/closed or wrong/);
    await expect(
      t.owner(`update public.organisations set verified_at = now(), verified_route = 'references'`)
    ).rejects.toThrow(/not verified/);
  });

  it('only the family’s own children, at most 8', async () => {
    await family();
    for (let i = 1; i <= 8; i++) await child(`Kid ${String.fromCharCode(64 + i)}`);
    await expect(child('Kid Nine')).rejects.toThrow(/at most 8/);
    // Someone else's child can't be added.
    await family(STRANGER);
    const theirs = await child('Theirs', STRANGER);
    await expect(t.as(MOM, `select public.add_to_family($1, '1.0')`, [theirs])).rejects.toThrow(
      /your own children/
    );
  });

  it('no cards, staff, school enrolments or check marks; certificates name Robots For All', async () => {
    const cls = await family();
    const kid = await child('Thandi R');
    await expect(t.as(MOM, `select * from public.create_sign_in_cards($1)`, [cls])).rejects.toThrow(
      /no sign-in cards/
    );
    const { organisation_id: org } = await one(
      t.owner<{ organisation_id: string }>(
        `select organisation_id from public.classes where id = $1`,
        [cls]
      )
    );
    await expect(
      t.as(MOM, `select public.create_staff_invitation($1, 'teacher')`, [org])
    ).rejects.toThrow(/no staff/);
    await expect(
      t.service(`select public.create_pending_enrolment($1, $2, 4, $3, 1, $4, 1, $5)`, [
        cls,
        MOM,
        Buffer.from([1]),
        Buffer.from([2]),
        'd'.repeat(64)
      ])
    ).rejects.toThrow(/no school enrolments/);
    // A sheet recorded in the family can't be marked checked by the parent.
    const claims = JSON.stringify({
      role: 'authenticated',
      kind: 'learner',
      learner_id: kid,
      sv: 1
    });
    await t.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await t.db.exec('set role authenticated');
    await t.db.query(
      `insert into public.sheet_records (id, learner_id, lesson_id, sheet_code, steps_done, i_can,
         built_working, recorded_at)
       values ($1, $2, 'p1-crank-01', 'p1-crank-01-81feed', 9, array[true], true, now())`,
      ['e'.repeat(32), kid]
    );
    await t.db.exec('reset role');
    await expect(t.as(MOM, `select public.check_record($1)`, ['e'.repeat(32)])).rejects.toThrow(
      /school or club teacher/
    );
    expect(await t.service(`select public.certificate_label($1) as l`, [kid])).toEqual([
      { l: 'Robots For All' }
    ]);
  });

  it('a second parent joins by link once the first confirms, and becomes a guardian', async () => {
    await family();
    const kid = await child('Thandi R');
    const { token } = await one(
      t.as<{ token: string }>(MOM, `select public.create_guardian_invitation() as token`)
    );
    expect(await t.owner(`select token_hash from public.family_invitations`)).toEqual([
      { token_hash: createHash('sha256').update(token).digest('hex') }
    ]);
    await t.as(DAD, `select public.accept_guardian_invitation($1)`, [token]);
    // Not a guardian until confirmed.
    expect(await t.as(DAD, `select id from public.learners`)).toEqual([]);
    await expect(
      t.as(STRANGER, `select public.accept_guardian_invitation($1)`, [token])
    ).rejects.toThrow(/already used/);
    // The first parent sees who opened the link (their chosen name) before confirming.
    await t.as(DAD, `select public.touch_adult('Mr Radebe')`);
    expect(await t.as(MOM, `select display_name from public.family_invitations_waiting()`)).toEqual(
      [{ display_name: 'Mr Radebe' }]
    );
    expect(await t.as(STRANGER, `select * from public.family_invitations_waiting()`)).toEqual([]);
    const { id: inv } = await one(
      t.as<{ id: string }>(MOM, `select id from public.family_invitations`)
    );
    await expect(t.as(DAD, `select public.confirm_guardian($1)`, [inv])).rejects.toThrow(
      /only the family/
    );
    await t.as(MOM, `select public.confirm_guardian($1)`, [inv]);
    expect(await t.as(DAD, `select id from public.learners`)).toEqual([{ id: kid }]);
    expect(
      await t.as(DAD, `select learner_id from public.guardian_learner_session($1)`, [kid])
    ).toEqual([{ learner_id: kid }]);
  });

  it('“Learn as <child>” is only for the child’s parent or guardian', async () => {
    await family();
    const kid = await child('Thandi R');
    expect(
      await t.as(MOM, `select nickname, session_version from public.guardian_learner_session($1)`, [
        kid
      ])
    ).toEqual([{ nickname: 'Thandi R', session_version: 1 }]);
    await expect(
      t.as(STRANGER, `select * from public.guardian_learner_session($1)`, [kid])
    ).rejects.toThrow(/parent or guardian/);
  });
});

describe('personal learners (migration 0024)', () => {
  it('an adult adds their own learner profile (18+, own consent, one only, in no group)', async () => {
    await expect(
      t.as(ADULT, `select public.create_personal_learner('Sam', 'robot', 'en', '1.0', false)`)
    ).rejects.toThrow(/18 or older/);
    const { id } = await one(
      t.as<{ id: string }>(
        ADULT,
        `select public.create_personal_learner('Sam', 'robot', 'en', '1.0', true) as id`
      )
    );
    const again = await one(
      t.as<{ id: string }>(
        ADULT,
        `select public.create_personal_learner('Other', 'robot', 'en', '1.0', true) as id`
      )
    );
    expect(again.id).toBe(id);
    expect(
      await t.as(ADULT, `select learner_id from public.guardian_learner_session($1)`, [id])
    ).toEqual([{ learner_id: id }]);
    expect(await t.service(`select public.certificate_label($1) as l`, [id])).toEqual([
      { l: 'Robots For All' }
    ]);
    expect(
      await t.owner(`select 1 from public.class_learners where learner_id = $1`, [id])
    ).toEqual([]);
    // The account page knows it's theirs, and nobody else sees it as theirs.
    expect(await t.as(ADULT, `select public.my_personal_learner() as id`)).toEqual([{ id }]);
    expect(await t.as(MOM, `select public.my_personal_learner() as id`)).toEqual([{ id: null }]);
  });
});
