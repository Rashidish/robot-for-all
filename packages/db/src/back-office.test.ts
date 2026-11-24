// The back-office database rules (ADR-0010), run on real Postgres (PGlite) with a stand-in for
// the small part of Supabase they use. Each test signs in as a person with given roles, with or
// without MFA, and checks what the database allows and refuses.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const here = import.meta.dirname;
const stub = readFileSync(join(here, '../test-support/supabase-stub.sql'), 'utf8');
const migrationsDir = join(here, '../migrations');
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'));

const ROOT = '00000000-0000-4000-8000-000000000001'; // the first super admin
const OWNER = '00000000-0000-4000-8000-000000000002';
const EDITOR = '00000000-0000-4000-8000-000000000003';
const NEWBIE = '00000000-0000-4000-8000-000000000004'; // signed in, no role
const SECOND = '00000000-0000-4000-8000-000000000005'; // break-glass super admin

let db: PGlite;

/** Runs SQL as the database owner (migrations, setup). */
const asOwner = (sql: string, params: unknown[] = []) => db.query(sql, params);

/** Runs SQL as a signed-in user, the way Supabase does: role "authenticated" plus JWT claims. */
async function as<T = Record<string, unknown>>(
  user: string,
  sql: string,
  params: unknown[] = [],
  { mfa = true }: { mfa?: boolean } = {}
): Promise<T[]> {
  const claims = JSON.stringify({ sub: user, role: 'authenticated', aal: mfa ? 'aal2' : 'aal1' });
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec('set role authenticated');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

/** Runs SQL as the service role (the admin app's server, or the owner's set-up script). */
async function asService(sql: string, params: unknown[] = []) {
  await db.exec('set role service_role');
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

const roles = async (user: string) =>
  (
    await asOwner(`select role from public.admin_roles where user_id = $1 order by role`, [user])
  ).rows.map((r) => (r as { role: string }).role);

const auditActions = async () =>
  (await asOwner(`select action from public.audit_log order by id`)).rows.map(
    (r) => (r as { action: string }).action
  );

beforeEach(async () => {
  db = new PGlite();
  await db.exec(stub);
  for (const m of migrations) await db.exec(m);
  for (const [id, email] of [
    [ROOT, 'root@example.org'],
    [OWNER, 'owner@example.org'],
    [EDITOR, 'editor@example.org'],
    [NEWBIE, 'newbie@example.org'],
    [SECOND, 'vault@example.org']
  ]) {
    await asOwner(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await asService(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await as(ROOT, `select public.grant_role($1, 'owner')`, [OWNER]);
  await as(OWNER, `select public.grant_role($1, 'content_editor')`, [EDITOR]);
});

describe('setting up the first super admin', () => {
  it('works once, with the service key only, and is in the audit log', async () => {
    expect(await roles(ROOT)).toEqual(['super_admin']);
    await expect(asService(`select public.bootstrap_super_admin($1)`, [SECOND])).rejects.toThrow(
      /already exists/
    );
    await expect(as(NEWBIE, `select public.bootstrap_super_admin($1)`, [NEWBIE])).rejects.toThrow(
      /permission denied/
    );
    expect((await auditActions())[0]).toBe('role.bootstrap');
  });
});

describe('giving and taking away roles', () => {
  it('an owner gives roles below owner, and each change is audited', async () => {
    await as(OWNER, `select public.grant_role($1, 'reviewer')`, [NEWBIE]);
    expect(await roles(NEWBIE)).toEqual(['reviewer']);
    await as(OWNER, `select public.revoke_role($1, 'reviewer')`, [NEWBIE]);
    expect(await roles(NEWBIE)).toEqual([]);
    expect(await auditActions()).toEqual([
      'role.bootstrap',
      'role.grant',
      'role.grant',
      'role.grant',
      'role.revoke'
    ]);
    const [last] = (await asOwner(`select user_id from public.audit_log order by id desc limit 1`))
      .rows as { user_id: string }[];
    expect(last?.user_id).toBe(OWNER);
  });

  it('only a super admin gives or takes away owner and super admin', async () => {
    await expect(as(OWNER, `select public.grant_role($1, 'owner')`, [NEWBIE])).rejects.toThrow(
      /only a super admin/
    );
    await expect(as(OWNER, `select public.grant_role($1, 'super_admin')`, [OWNER])).rejects.toThrow(
      /only a super admin/
    );
    await as(ROOT, `select public.grant_role($1, 'super_admin')`, [SECOND]);
    expect(await roles(SECOND)).toEqual(['super_admin']);
  });

  it('people without the owner role, or without MFA, can give nothing', async () => {
    await expect(as(EDITOR, `select public.grant_role($1, 'reviewer')`, [NEWBIE])).rejects.toThrow(
      /only an owner/
    );
    await expect(as(NEWBIE, `select public.grant_role($1, 'reviewer')`, [NEWBIE])).rejects.toThrow(
      /only an owner/
    );
    await expect(
      as(OWNER, `select public.grant_role($1, 'reviewer')`, [NEWBIE], { mfa: false })
    ).rejects.toThrow(/only an owner/);
    expect(await roles(NEWBIE)).toEqual([]);
  });

  it('nobody can write to the roles table directly, the service role included', async () => {
    await expect(
      as(OWNER, `insert into public.admin_roles (user_id, role) values ($1, 'reviewer')`, [NEWBIE])
    ).rejects.toThrow(/permission denied/);
    await expect(
      asService(`insert into public.admin_roles (user_id, role) values ($1, 'owner')`, [NEWBIE])
    ).rejects.toThrow(/permission denied/);
  });
});

describe('there is always a super admin', () => {
  it("the last super admin can't be removed, even by deleting their account", async () => {
    await expect(as(ROOT, `select public.revoke_role($1, 'super_admin')`, [ROOT])).rejects.toThrow(
      /at least one super admin/
    );
    await expect(asOwner(`delete from auth.users where id = $1`, [ROOT])).rejects.toThrow(
      /at least one super admin/
    );
    expect(await roles(ROOT)).toEqual(['super_admin']);
  });

  it('with a vaulted break-glass super admin, one of the two can step down', async () => {
    await as(ROOT, `select public.grant_role($1, 'super_admin')`, [SECOND]);
    await as(SECOND, `select public.revoke_role($1, 'super_admin')`, [ROOT]);
    expect(await roles(ROOT)).toEqual([]);
  });
});

describe('who sees what', () => {
  it("people see their own roles; owners see everyone's; nothing without MFA", async () => {
    const own = await as<{ role: string }>(EDITOR, `select role from public.admin_roles`);
    expect(own.map((r) => r.role)).toEqual(['content_editor']);
    const all = await as(OWNER, `select role from public.admin_roles`);
    expect(all).toHaveLength(3);
    expect(await as(OWNER, `select role from public.admin_roles`, [], { mfa: false })).toEqual([]);
  });

  it('only owners and super admins read the audit log', async () => {
    expect((await as(OWNER, `select id from public.audit_log`)).length).toBeGreaterThan(0);
    expect((await as(ROOT, `select id from public.audit_log`)).length).toBeGreaterThan(0);
    expect(await as(EDITOR, `select id from public.audit_log`)).toEqual([]);
    expect(await as(OWNER, `select id from public.audit_log`, [], { mfa: false })).toEqual([]);
  });

  it('a super admin has every role', async () => {
    const [row] = await as<{ ok: boolean }>(ROOT, `select public.has_role('judge') as ok`);
    expect(row?.ok).toBe(true);
    const [editor] = await as<{ ok: boolean }>(EDITOR, `select public.has_role('judge') as ok`);
    expect(editor?.ok).toBe(false);
  });
});

describe('the audit log', () => {
  it("back-office users with MFA record their actions; others can't", async () => {
    await as(EDITOR, `select public.log_action('season.dates', 'rhino-patrol', null, $1)`, [
      { from: '2026-12-01' }
    ]);
    expect((await auditActions()).at(-1)).toBe('season.dates');
    await expect(
      as(NEWBIE, `select public.log_action('season.dates', 'x', null, null)`)
    ).rejects.toThrow(/only back-office users/);
    await expect(
      as(EDITOR, `select public.log_action('season.dates', 'x', null, null)`, [], { mfa: false })
    ).rejects.toThrow(/only back-office users/);
  });

  it("can't be written, changed or emptied directly by anyone", async () => {
    await expect(
      as(OWNER, `insert into public.audit_log (action) values ('role.grant')`)
    ).rejects.toThrow(/permission denied/);
    await expect(asService(`update public.audit_log set action = 'x.y'`)).rejects.toThrow(
      /permission denied/
    );
    await expect(asService(`delete from public.audit_log`)).rejects.toThrow(/permission denied/);
    // Even the table's owner is stopped by the triggers.
    await expect(asOwner(`update public.audit_log set target = 'x'`)).rejects.toThrow(
      /can't be changed/
    );
    await expect(asOwner(`delete from public.audit_log`)).rejects.toThrow(/can't be changed/);
    await expect(asOwner(`truncate public.audit_log`)).rejects.toThrow(/can't be changed/);
  });
});

describe('super-admin overrides', () => {
  it('need a super admin and a written reason, and are marked in the log', async () => {
    await expect(
      as(OWNER, `select public.record_override('lesson.approve_own', 'p2-art-01', $1, null)`, [
        'no second reviewer yet'
      ])
    ).rejects.toThrow(/only a super admin/);
    await expect(
      as(ROOT, `select public.record_override('lesson.approve_own', 'p2-art-01', $1, null)`, ['ok'])
    ).rejects.toThrow(/reason of at least 10/);
    await as(ROOT, `select public.record_override('lesson.approve_own', 'p2-art-01', $1, null)`, [
      '  typo fix, no second reviewer yet  '
    ]);
    const rows = await as<{ action: string; override_reason: string; user_id: string }>(
      OWNER,
      `select action, override_reason, user_id from public.audit_log where override_reason is not null`
    );
    expect(rows).toEqual([
      {
        action: 'lesson.approve_own',
        override_reason: 'typo fix, no second reviewer yet',
        user_id: ROOT
      }
    ]);
  });
});

describe('the people screen (migration 0002)', () => {
  it('owners and super admins see everyone with a role, with emails', async () => {
    const rows = await as<{ email: string; roles: string[] }>(
      OWNER,
      `select email, roles from public.admin_people()`
    );
    expect(rows).toEqual([
      { email: 'editor@example.org', roles: ['content_editor'] },
      { email: 'owner@example.org', roles: ['owner'] },
      { email: 'root@example.org', roles: ['super_admin'] }
    ]);
  });

  it('nobody else sees the list, and nobody without MFA', async () => {
    await expect(as(EDITOR, `select * from public.admin_people()`)).rejects.toThrow(
      /only an owner/
    );
    await expect(
      as(OWNER, `select * from public.admin_people()`, [], { mfa: false })
    ).rejects.toThrow(/only an owner/);
  });

  it('gives a role by email, with the same rules as grant_role', async () => {
    await as(OWNER, `select public.grant_role_by_email($1, 'reviewer')`, ['  Newbie@Example.org ']);
    expect(await roles(NEWBIE)).toEqual(['reviewer']);
    await expect(
      as(OWNER, `select public.grant_role_by_email($1, 'owner')`, ['newbie@example.org'])
    ).rejects.toThrow(/only a super admin/);
    await expect(
      as(OWNER, `select public.grant_role_by_email($1, 'judge')`, ['nobody@example.org'])
    ).rejects.toThrow(/sign up first/);
    await expect(
      as(EDITOR, `select public.grant_role_by_email($1, 'judge')`, ['newbie@example.org'])
    ).rejects.toThrow(/only an owner/);
  });
});
