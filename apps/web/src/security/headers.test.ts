// Guards the security headers in public/_headers (M1 spec §8) against accidental weakening.
import { describe, expect, it } from 'vitest';
import headersFile from '../../public/_headers?raw';

function block(path: string): Record<string, string> {
  const lines = headersFile.split('\n');
  const start = lines.findIndex((l) => l.trim() === path);
  const out: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    const [name, ...rest] = line.trim().split(':');
    out[(name ?? '').toLowerCase()] = rest.join(':').trim();
  }
  return out;
}

const all = block('/*');
const csp = Object.fromEntries(
  (all['content-security-policy'] ?? '')
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .map(([name, ...values]) => [name, values])
) as Record<string, string[]>;

describe('security headers', () => {
  it('sets the full header set on every page', () => {
    for (const name of [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy',
      'cross-origin-opener-policy'
    ]) {
      expect(all[name], name).toBeTruthy();
    }
  });

  it('only allows code and styles from our own site', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['style-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
  });

  it('never allows unsafe-inline, unsafe-eval or wildcards', () => {
    const policy = all['content-security-policy'] ?? '';
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|\*|https?:/);
  });

  it('turns off camera, microphone and location', () => {
    const perms = all['permissions-policy'] ?? '';
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()']) {
      expect(perms).toContain(feature);
    }
  });

  it('never caches the service worker, and caches hashed assets for a year', () => {
    expect(block('/sw.js')['cache-control']).toBe('no-cache');
    expect(block('/_astro/*')['cache-control']).toContain('immutable');
  });

  describe('code editor (/code/*)', () => {
    const code = block('/code/*');
    const policy = code['content-security-policy'] ?? '';
    const directives = Object.fromEntries(
      policy
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .map(([name, ...values]) => [name, values])
    ) as Record<string, string[]>;

    it('replaces the site-wide policy instead of adding a second one', () => {
      expect(headersFile).toMatch(
        /\/code\/\*\n\s+! Content-Security-Policy\n\s+! Permissions-Policy/
      );
    });

    it('keeps the same policy as every other page, apart from style hashes', () => {
      const strip = (p: string) => p.replace(/ 'sha256-[A-Za-z0-9+/=]+'/g, '');
      expect(strip(policy)).toBe(all['content-security-policy']);
      expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|\*|https?:/);
      for (const value of directives['style-src'] ?? []) {
        expect(value).toMatch(/^'self'$|^'sha256-[A-Za-z0-9+/=]+'$/);
      }
    });

    it('allows WebUSB for our own site only, and nothing else new', () => {
      const perms = code['permissions-policy'] ?? '';
      expect(perms).toContain('usb=(self)');
      expect(perms.replace('usb=(self)', 'usb=()')).toBe(all['permissions-policy']);
    });
  });
});
