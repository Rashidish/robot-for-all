// Who may open which admin page (pure, so it is unit-tested). The middleware gathers the facts
// (Access token, sign-in, MFA, roles) and this decides: show the page, send the person to sign in
// or to MFA, or refuse.

export interface Facts {
  /** The Cloudflare Access check passed (or is off in local development only). */
  access: boolean;
  /** Signed in with a password (MFA not yet done). */
  signedIn: boolean;
  /** Finished MFA in this session (Supabase "aal2"). */
  mfa: boolean;
  /** Has at least one back-office role. */
  hasRole: boolean;
}

export type Decision =
  { kind: 'allow' } | { kind: 'redirect'; to: string } | { kind: 'forbidden'; reason: string };

/** Pages that work before MFA: signing in, MFA itself, signing out. */
const BEFORE_MFA = new Set(['/sign-in/', '/mfa/', '/sign-out/']);

export function decide(pathname: string, f: Facts): Decision {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (!f.access) return { kind: 'forbidden', reason: 'access' };
  if (path === '/sign-in/')
    return f.signedIn ? { kind: 'redirect', to: '/mfa/' } : { kind: 'allow' };
  if (!f.signedIn) return { kind: 'redirect', to: '/sign-in/' };
  if (BEFORE_MFA.has(path)) {
    return path === '/mfa/' && f.mfa ? { kind: 'redirect', to: '/' } : { kind: 'allow' };
  }
  if (!f.mfa) return { kind: 'redirect', to: '/mfa/' };
  if (!f.hasRole && path !== '/no-role/') return { kind: 'redirect', to: '/no-role/' };
  return { kind: 'allow' };
}

/** Security headers on every admin response (ADR-0009): strict CSP, never indexed or cached. */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};
