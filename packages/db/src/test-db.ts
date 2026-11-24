// Test helper: a fresh Postgres (PGlite) with the Supabase stand-in and every migration, and
// ways to run SQL as a signed-in person (with or without MFA), the service role or the owner.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
const stub = readFileSync(join(here, '../test-support/supabase-stub.sql'), 'utf8');
const migrationsDir = join(here, '../migrations');
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'));

export class TestDb {
  private constructor(readonly db: PGlite) {}

  static async create(users: Record<string, string>): Promise<TestDb> {
    const t = new TestDb(new PGlite());
    await t.db.exec(stub);
    for (const m of migrations) await t.db.exec(m);
    for (const [id, email] of Object.entries(users)) {
      await t.db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
    }
    return t;
  }

  /** As the database owner (set-up). */
  async owner<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, params)).rows;
  }

  /** As the service role. */
  async service<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.db.exec('set role service_role');
    try {
      return (await this.db.query<T>(sql, params)).rows;
    } finally {
      await this.db.exec('reset role');
    }
  }

  /** As a signed-in person, the way Supabase does it: role "authenticated" plus JWT claims. */
  async as<T = Record<string, unknown>>(
    user: string,
    sql: string,
    params: unknown[] = [],
    { mfa = true }: { mfa?: boolean } = {}
  ): Promise<T[]> {
    const claims = JSON.stringify({ sub: user, role: 'authenticated', aal: mfa ? 'aal2' : 'aal1' });
    await this.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await this.db.exec('set role authenticated');
    try {
      return (await this.db.query<T>(sql, params)).rows;
    } finally {
      await this.db.exec('reset role');
      await this.db.query(`select set_config('request.jwt.claims', '', false)`);
    }
  }
}
