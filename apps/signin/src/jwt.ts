// Learner sessions (ADR-0013 amendment): a JWT signed with Supabase's JWT secret (HS256), so the
// database accepts it and its own rules apply: role "authenticated", kind "learner", learner_id
// and the session version (sv). No name, no class, nothing else about the child.

const enc = new TextEncoder();
const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const part = (o: unknown) => b64url(enc.encode(JSON.stringify(o)));

/** Sessions last 30 days on the phone that signed in. */
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

export async function learnerToken(
  secret: string,
  learner: string,
  sv: number,
  nowSeconds: number
): Promise<{ token: string; expiresAt: number }> {
  const exp = nowSeconds + SESSION_SECONDS;
  const head = part({ alg: 'HS256', typ: 'JWT' });
  const body = part({
    role: 'authenticated',
    aud: 'authenticated',
    iss: 'robotsforall-signin',
    kind: 'learner',
    learner_id: learner,
    sv,
    iat: nowSeconds,
    exp
  });
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`)));
  return { token: `${head}.${body}.${b64url(sig)}`, expiresAt: exp };
}
