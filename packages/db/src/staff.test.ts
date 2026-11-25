// M5 step 3d (migration 0011): inviting staff by a one-time link, and removing them.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const COLLEAGUE = '00000000-0000-4000-8000-000000000012';
const STRANGER = '00000000-0000-4000-8000-000000000013';
let t: TestDb;
let org: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

beforeEach(async () => {
  t = await TestDb.create({
    [ADMIN]: 'admin@example.org',
    [COLLEAGUE]: 'colleague@example.org',
    [STRANGER]: 'stranger@example.org'
  });
  await t.as(ADMIN, `select public.touch_adult('Mr Khumalo')`);
  await t.as(COLLEAGUE, `select public.touch_adult('Ms Naidoo')`);
  ({ id: org } = await one(
    t.as<{ id: string }>(
      ADMIN,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  ));
});

const invite = async (role = 'teacher', by = ADMIN) =>
  (
    await one(
      t.as<{ token: string }>(by, `select public.create_staff_invitation($1, $2) as token`, [
        org,
        role
      ])
    )
  ).token;

describe('staff invitations (migration 0011)', () => {
  it('the admin invites; the colleague joins once; the secret is never stored', async () => {
    const token = await invite();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const stored = await t.owner<{ token_hash: string }>(
      `select token_hash from public.staff_invitations`
    );
    expect(stored[0]?.token_hash).not.toBe(token);
    await t.as(COLLEAGUE, `select public.accept_staff_invitation($1)`, [token]);
    const staff = await t.as<{ display_name: string; role: string }>(
      COLLEAGUE,
      `select display_name, role from public.organisation_staff_list($1)`,
      [org]
    );
    expect(staff).toEqual([
      { display_name: 'Mr Khumalo', role: 'admin' },
      { display_name: 'Ms Naidoo', role: 'teacher' }
    ]);
    await expect(
      t.as(STRANGER, `select public.accept_staff_invitation($1)`, [token])
    ).rejects.toThrow(/used already/);
  });

  it('only the admin invites; invitations expire; the token is not readable', async () => {
    await expect(invite('teacher', STRANGER)).rejects.toThrow(/admin/);
    const token = await invite();
    await expect(t.as(ADMIN, `select token_hash from public.staff_invitations`)).rejects.toThrow(
      /permission denied/
    );
    await t.owner(`update public.staff_invitations set expires_at = now() - interval '1 minute'`);
    await expect(
      t.as(COLLEAGUE, `select public.accept_staff_invitation($1)`, [token])
    ).rejects.toThrow(/expired/);
  });

  it('strangers can not see the staff list; the last admin can not be removed', async () => {
    await expect(
      t.as(STRANGER, `select * from public.organisation_staff_list($1)`, [org])
    ).rejects.toThrow(/only staff/);
    await expect(t.as(ADMIN, `select public.remove_staff($1, $2)`, [org, ADMIN])).rejects.toThrow(
      /at least one admin/
    );
    const token = await invite('teacher');
    await t.as(COLLEAGUE, `select public.accept_staff_invitation($1)`, [token]);
    await t.as(ADMIN, `select public.remove_staff($1, $2)`, [org, COLLEAGUE]);
    expect(await t.as(COLLEAGUE, `select id from public.organisations`)).toEqual([]);
  });
});
