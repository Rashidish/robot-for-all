import { describe, expect, it } from 'vitest';
import { allowedPath } from './proxy';

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
