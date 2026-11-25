import { describe, expect, it } from 'vitest';
import { allowedPath, RPC } from './proxy';

describe('the /db/ proxy forwards only what the account pages need (ADR-0017)', () => {
  it('sign-in calls', () => {
    expect(allowedPath('POST', 'auth/v1/otp')).toBe('auth/v1/otp');
    expect(allowedPath('POST', 'auth/v1/verify')).toBe('auth/v1/verify');
    expect(allowedPath('GET', 'auth/v1/user')).toBe('auth/v1/user');
    expect(allowedPath('GET', 'auth/v1/otp')).toBeNull();
    expect(allowedPath('POST', 'auth/v1/admin/users')).toBeNull();
  });

  it('only listed database functions, by POST', () => {
    expect(allowedPath('POST', 'rest/v1/rpc/create_class')).toBe('rest/v1/rpc/create_class');
    expect(allowedPath('GET', 'rest/v1/rpc/create_class')).toBeNull();
    // Service-role functions are never reachable through the site.
    expect(allowedPath('POST', 'rest/v1/rpc/set_certificate_name')).toBeNull();
    expect(allowedPath('POST', 'rest/v1/rpc/delete_dormant_accounts')).toBeNull();
    expect(allowedPath('POST', 'rest/v1/rpc/grant_role')).toBeNull();
  });

  it('reads of listed tables; writes only to a learner’s sheet records', () => {
    expect(allowedPath('GET', 'rest/v1/classes')).toBe('rest/v1/classes');
    expect(allowedPath('GET', 'rest/v1/audit_log')).toBeNull();
    expect(allowedPath('GET', 'rest/v1/admin_roles')).toBeNull();
    expect(allowedPath('POST', 'rest/v1/classes')).toBeNull();
    expect(allowedPath('DELETE', 'rest/v1/learners')).toBeNull();
    expect(allowedPath('POST', 'rest/v1/sheet_records')).toBe('rest/v1/sheet_records');
  });

  it('refuses odd paths', () => {
    expect(allowedPath('GET', 'rest/v1/../v1/classes')).toBeNull();
    expect(allowedPath('GET', 'rest/v1/classes%2F..')).toBeNull();
    expect(allowedPath('GET', 'rest/v2/classes')).toBeNull();
    expect(allowedPath('GET', 'storage/v1/object')).toBeNull();
    expect(allowedPath('GET', '')).toBeNull();
  });
});

describe('every database function the pages call is allowed', () => {
  it('matches the allow-list', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) {
          if (f !== 'paraglide') walk(p);
        } else if (/\.(svelte|ts)$/.test(f) && !f.endsWith('.test.ts')) files.push(p);
      }
    };
    walk(join(import.meta.dirname, '..'));
    const called = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\.rpc(?:<[^>]*>)?\(\s*'([a-z_]+)'/g)) {
        if (m[1]) called.add(m[1]);
      }
    }
    expect(called.size).toBeGreaterThan(10);
    expect([...called].filter((fn) => !RPC.has(fn))).toEqual([]);
  });
});
