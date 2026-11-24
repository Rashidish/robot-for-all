import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyAccess } from './access';
import { decide, type Facts, SECURITY_HEADERS } from './guard';
import {
  canEditSeasons,
  canManagePeople,
  canWithdraw,
  grantableRoles,
  hasRole,
  isRole,
  ROLE_LABELS,
  ROLES,
  withdrawTypesFor
} from './roles';

describe('Cloudflare Access token check (ADR-0009)', () => {
  const config = { team: 'robotsforall', aud: 'aud-tag-123' };
  let keys: ReturnType<typeof createLocalJWKSet>;
  let sign: (claims: Record<string, unknown>, opts?: { exp?: string }) => Promise<string>;
  let otherKey: CryptoKey;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    otherKey = (await generateKeyPair('RS256')).privateKey;
    keys = createLocalJWKSet({
      keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }]
    });
    sign = (claims, opts = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer('https://robotsforall.cloudflareaccess.com')
        .setAudience(config.aud)
        .setIssuedAt()
        .setExpirationTime(opts.exp ?? '10m')
        .sign(privateKey);
  });

  it('accepts a token from our team, for our app, with an email', async () => {
    const token = await sign({ email: 'owner@example.org' });
    expect(await verifyAccess(token, config, keys)).toEqual({
      ok: true,
      email: 'owner@example.org'
    });
  });

  it('refuses a missing, expired, wrongly signed or wrong-app token', async () => {
    expect((await verifyAccess(null, config, keys)).ok).toBe(false);
    expect(
      (await verifyAccess(await sign({ email: 'a@b.c' }, { exp: '-1m' }), config, keys)).ok
    ).toBe(false);
    expect(
      (await verifyAccess(await sign({ email: 'a@b.c' }), { ...config, aud: 'other' }, keys)).ok
    ).toBe(false);
    expect(
      (await verifyAccess(await sign({ email: 'a@b.c' }), { ...config, team: 'evil' }, keys)).ok
    ).toBe(false);
    const forged = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://robotsforall.cloudflareaccess.com')
      .setAudience(config.aud)
      .setExpirationTime('10m')
      .sign(otherKey);
    expect((await verifyAccess(forged, config, keys)).ok).toBe(false);
    expect((await verifyAccess(await sign({}), config, keys)).ok).toBe(false);
  });

  it('refuses everything when Access is not configured', async () => {
    const token = await sign({ email: 'a@b.c' });
    expect(await verifyAccess(token, { team: '', aud: '' }, keys)).toEqual({
      ok: false,
      reason: 'Access is not configured'
    });
  });
});

describe('which page a person may open', () => {
  const all: Facts = { access: true, signedIn: true, mfa: true, hasRole: true };

  it('without Access: nothing at all, not even sign-in', () => {
    for (const p of ['/', '/sign-in/', '/mfa/', '/roles/']) {
      expect(decide(p, { ...all, access: false }).kind).toBe('forbidden');
    }
  });

  it('signed out: only the sign-in page', () => {
    const out = { ...all, signedIn: false, mfa: false, hasRole: false };
    expect(decide('/sign-in/', out)).toEqual({ kind: 'allow' });
    expect(decide('/', out)).toEqual({ kind: 'redirect', to: '/sign-in/' });
    expect(decide('/roles', out)).toEqual({ kind: 'redirect', to: '/sign-in/' });
    expect(decide('/mfa/', out)).toEqual({ kind: 'redirect', to: '/sign-in/' });
  });

  it('password only (no MFA yet): only MFA and sign-out', () => {
    const half = { ...all, mfa: false };
    expect(decide('/mfa/', half)).toEqual({ kind: 'allow' });
    expect(decide('/sign-out/', half)).toEqual({ kind: 'allow' });
    expect(decide('/', half)).toEqual({ kind: 'redirect', to: '/mfa/' });
    expect(decide('/sign-in/', half)).toEqual({ kind: 'redirect', to: '/mfa/' });
  });

  it('with MFA but no role: the no-role page only', () => {
    const none = { ...all, hasRole: false };
    expect(decide('/', none)).toEqual({ kind: 'redirect', to: '/no-role/' });
    expect(decide('/no-role/', none)).toEqual({ kind: 'allow' });
  });

  it('with MFA and a role: the admin pages', () => {
    expect(decide('/', all)).toEqual({ kind: 'allow' });
    expect(decide('/roles/', all)).toEqual({ kind: 'allow' });
    expect(decide('/mfa/', all)).toEqual({ kind: 'redirect', to: '/' });
  });

  it('every response is never indexed, never cached and has a strict CSP', () => {
    expect(SECURITY_HEADERS['X-Robots-Tag']).toContain('noindex');
    expect(SECURITY_HEADERS['Cache-Control']).toBe('no-store');
    const csp = SECURITY_HEADERS['Content-Security-Policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('roles in the pages (the database enforces them too)', () => {
  it('matches the database role list and has a label for each', () => {
    const sql = readFileSync(
      join(
        import.meta.dirname,
        '../../../../packages/db/migrations/0001_back_office_roles_and_audit.sql'
      ),
      'utf8'
    );
    const enumBody = /create type public\.admin_role as enum \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    expect([...enumBody.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...ROLES]);
    for (const r of ROLES) expect(ROLE_LABELS[r]).toBeTruthy();
    expect(isRole('owner')).toBe(true);
    expect(isRole('admin')).toBe(false);
  });

  it('owners give roles below owner; super admins give all; others none', () => {
    expect(grantableRoles(['owner'])).not.toContain('owner');
    expect(grantableRoles(['owner'])).not.toContain('super_admin');
    expect(grantableRoles(['owner'])).toContain('reviewer');
    expect(grantableRoles(['super_admin'])).toEqual([...ROLES]);
    expect(grantableRoles(['reviewer', 'judge'])).toEqual([]);
  });

  it('a super admin has every role', () => {
    expect(hasRole(['super_admin'], 'judge')).toBe(true);
    expect(hasRole(['reviewer'], 'judge')).toBe(false);
    expect(canManagePeople(['owner'])).toBe(true);
    expect(canManagePeople(['content_editor'])).toBe(false);
    expect(canEditSeasons(['competition_manager'])).toBe(true);
    expect(canEditSeasons(['owner'])).toBe(true);
    expect(canEditSeasons(['super_admin'])).toBe(true);
    expect(canEditSeasons(['reviewer', 'judge'])).toBe(false);
    expect(canWithdraw(['reviewer'])).toBe(true);
    expect(canWithdraw(['content_editor', 'judge'])).toBe(false);
    expect(withdrawTypesFor(['competition_manager'])).toEqual(['world', 'season']);
    expect(withdrawTypesFor(['reviewer'])).toContain('template');
    expect(withdrawTypesFor(['judge'])).toEqual([]);
  });
});
