// Cloudflare Access (ADR-0009): the outer gate in front of the whole admin site. Access signs a
// token for every request it lets through (header Cf-Access-Jwt-Assertion). We check it on every
// request too, so a mistake in the Access set-up can't open the admin app.
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';

export const ACCESS_HEADER = 'cf-access-jwt-assertion';

export interface AccessConfig {
  /** The Zero Trust team name, as in <team>.cloudflareaccess.com. */
  team: string;
  /** The Access application's audience tag (AUD). */
  aud: string;
}

export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };

const keySets = new Map<string, JWTVerifyGetKey>();

/** The team's public signing keys (cached; jose refreshes them when Access rotates keys). */
export function teamKeys(team: string): JWTVerifyGetKey {
  let keys = keySets.get(team);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`));
    keySets.set(team, keys);
  }
  return keys;
}

/**
 * The team name as Cloudflare's dashboard may show it ("robotsforall", "robotsforall.cloudflareaccess.com"
 * or "https://robotsforall.cloudflareaccess.com/"), reduced to "robotsforall". Anything else is refused.
 */
export function teamName(value: string): string | null {
  const team = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\.cloudflareaccess\.com$/, '');
  return /^[a-z0-9-]{1,63}$/.test(team) ? team : null;
}

/** Checks an Access token: signed by our team, for our application, not expired, with an email. */
export async function verifyAccess(
  token: string | null,
  config: AccessConfig,
  givenKeys?: JWTVerifyGetKey
): Promise<AccessResult> {
  const team = teamName(config.team);
  if (!team || !config.aud.trim()) return { ok: false, reason: 'Access is not configured' };
  if (!token) return { ok: false, reason: 'no Access token' };
  try {
    const keys = givenKeys ?? teamKeys(team);
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://${team}.cloudflareaccess.com`,
      audience: config.aud.trim(),
      algorithms: ['RS256']
    });
    const email = typeof payload['email'] === 'string' ? payload['email'] : '';
    if (!email) return { ok: false, reason: 'Access token has no email' };
    return { ok: true, email };
  } catch (err) {
    return { ok: false, reason: `Access token refused (${(err as Error).name})` };
  }
}
