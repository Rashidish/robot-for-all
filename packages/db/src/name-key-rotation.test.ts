// Name key rotation (migration 0027, ADR-0015): the certificate service re-locks values stored
// under an older key version; the database only hands out and takes back locked bytes.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const DPO = '00000000-0000-4000-8000-000000000002';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const PARENT = '00000000-0000-4000-8000-000000000021';
let t: TestDb;
let cls: string;
let learner: string;
let pending: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
const hex = (b: number[]) => `\\x${Buffer.from(b).toString('hex')}`;

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [DPO]: 'dpo@example.org',
    [TEACHER]: 'teacher@example.org',
    [PARENT]: 'parent@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await t.as(ROOT, `select public.grant_role($1, 'data_protection_officer')`, [DPO]);
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
  const { enrol_token } = await one(
    t.owner<{ enrol_token: string }>(`select enrol_token from public.classes where id = $1`, [cls])
  );
  ({ id: learner } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'robot', 'en', '1.0') as id`,
      [enrol_token]
    )
  ));
  await t.owner(
    `update public.learners set certificate_name = '\\x0101', certificate_name_key_version = 1
      where id = $1`,
    [learner]
  );
  ({ id: pending } = await one(
    t.service<{ id: string }>(
      `select public.create_pending_enrolment($1, $2, 4, '\\x0202', 1, '\\x0303', 1, $3) as id`,
      [cls, TEACHER, 'a'.repeat(64)]
    )
  ));
  await t.service(`select public.store_pending_token($1, '\\x0404', 1)`, [pending]);
});

describe('name key rotation (migration 0027)', () => {
  it('lists every value on an older key, and nothing once all are on the current one', async () => {
    const rows = await t.service(`select * from public.names_to_rekey(2, 100) order by kind`);
    expect(rows).toEqual([
      {
        kind: 'learner',
        id: learner,
        token_hash: null,
        name: new Uint8Array([1, 1]),
        name_key: 1,
        contact: null,
        contact_key: null,
        token: null,
        token_key: null
      },
      {
        kind: 'pending',
        id: pending,
        token_hash: 'a'.repeat(64),
        name: new Uint8Array([2, 2]),
        name_key: 1,
        contact: new Uint8Array([3, 3]),
        contact_key: 1,
        token: new Uint8Array([4, 4]),
        token_key: 1
      }
    ]);
    expect(await t.service(`select * from public.names_to_rekey(1, 100)`)).toEqual([]);
    expect(await t.service(`select * from public.name_key_counts()`)).toEqual([
      { key_version: 1, values_locked: 4 }
    ]);
  });

  it('saves re-locked values only while they are still on the old key, and logs the count', async () => {
    // A parent replaced the name with one on key 2 after the job read it: that one is kept.
    await t.owner(
      `update public.pending_enrolments set certificate_name = '\\x0909',
         certificate_name_key_version = 2 where id = $1`,
      [pending]
    );
    const rows = JSON.stringify([
      { kind: 'learner', id: learner, name: hex([5]), name_key: 2, old_name_key: 1 },
      {
        kind: 'pending',
        id: pending,
        name: hex([6]),
        name_key: 2,
        old_name_key: 1,
        contact: hex([7]),
        contact_key: 2,
        old_contact_key: 1,
        token: hex([8]),
        token_key: 2,
        old_token_key: 1
      }
    ]);
    expect(await t.service(`select public.rekey_names($1::jsonb) as n`, [rows])).toEqual([
      { n: 3 }
    ]);
    expect(
      await t.owner(
        `select certificate_name, certificate_name_key_version as v from public.learners`
      )
    ).toEqual([{ certificate_name: new Uint8Array([5]), v: 2 }]);
    expect(
      await t.owner(
        `select certificate_name as n, parent_contact as c, confirm_token_sealed as s,
           confirm_token_key_version as v from public.pending_enrolments`
      )
    ).toEqual([
      { n: new Uint8Array([9, 9]), c: new Uint8Array([7]), s: new Uint8Array([8]), v: 2 }
    ]);
    expect(await t.service(`select * from public.name_key_counts()`)).toEqual([
      { key_version: 2, values_locked: 4 }
    ]);
    expect(
      await t.owner(`select after from public.audit_log where action = 'privacy.names_rekeyed'`)
    ).toEqual([{ after: { count: 3 } }]);
  });

  it('only the service hands out or takes back locked values; the officer sees counts', async () => {
    for (const sql of [
      `select * from public.names_to_rekey(2, 10)`,
      `select public.rekey_names('[]')`,
      `select * from public.name_key_counts()`
    ]) {
      await expect(t.as(DPO, sql)).rejects.toThrow(/permission denied/);
      await expect(t.as(TEACHER, sql)).rejects.toThrow(/permission denied/);
    }
    expect(await t.as(DPO, `select * from public.name_key_counts_for_officer()`)).toEqual([
      { key_version: 1, values_locked: 4 }
    ]);
    await expect(
      t.as(TEACHER, `select * from public.name_key_counts_for_officer()`)
    ).rejects.toThrow(/data protection officer/);
  });
});
