import { beforeEach, describe, expect, it } from 'vitest';
import { decryptName, fromBytea, loadKeys } from './crypto';

async function keyOf(keys: Map<number, CryptoKey>, v: number): Promise<CryptoKey> {
  const k = keys.get(v);
  if (!k) throw new Error('no key');
  return k;
}
import { type Env, handle, RECENT_SIGN_IN, shortName } from './handler';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const CLASS = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const NOW = 1_800_000_000_000;
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: Buffer.alloc(32, 7).toString('base64') }),
  NAME_KEY_CURRENT: '1'
};

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (signedIn: number) =>
  `${b64url({ alg: 'HS256' })}.${b64url({ sub: USER, amr: [{ method: 'otp', timestamp: signedIn }] })}.sig`;

let calls: { url: string; init: RequestInit | undefined }[];
let stored: Record<string, unknown> | null;
let dbReply: () => Response;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, init });
  if (url.endsWith('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization');
    return auth?.includes('bad')
      ? new Response('{}', { status: 401 })
      : Response.json({ id: USER });
  }
  if (url.endsWith('/rpc/set_certificate_name')) {
    stored = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(null, { status: 204 });
  }
  if (url.endsWith('/rpc/reveal_class_names')) return dbReply();
  return new Response('{}', { status: 404 });
}) as typeof fetch;

const post = (path: string, body: unknown, token = jwt(NOW / 1000 - 60)) =>
  handle(
    new Request(`https://robotsforall.org.za${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
    env,
    { fetch: fakeFetch, now: () => NOW }
  );

beforeEach(() => {
  calls = [];
  stored = null;
  dbReply = () => Response.json([]);
});

describe('the certificate service', () => {
  it('encrypts a parent’s name before it reaches the database', async () => {
    const res = await post('/cert/name', {
      learner: LEARNER,
      name: ' Thandiwe  Radebe ',
      notice: '1.0'
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(stored)).not.toContain('Thandiwe');
    expect(stored).toMatchObject({ p_learner: LEARNER, p_by: USER, p_key: 1, p_notice: '1.0' });
    const key = await keyOf(await loadKeys(env.NAME_KEYS), 1);
    expect(await decryptName(key, LEARNER, fromBytea(String(stored?.['p_name'])))).toBe(
      'Thandiwe Radebe'
    );
    // The database is called with the service key; the browser never has it.
    const db = calls.find((c) => c.url.endsWith('/rpc/set_certificate_name'));
    expect(new Headers(db?.init?.headers).get('apikey')).toBe('service');
  });

  it('refuses no sign-in, bad input and other methods, without echoing the name', async () => {
    expect(
      (await post('/cert/name', { learner: LEARNER, name: 'A B', notice: '1.0' }, 'bad.x.y')).status
    ).toBe(401);
    const res = await post('/cert/name', {
      learner: LEARNER,
      name: '<b>Thandi</b>',
      notice: '1.0'
    });
    expect(res.status).toBe(422);
    expect(await res.text()).not.toContain('Thandi');
    expect(
      (await post('/cert/name', { learner: 'x', name: 'Thandi R', notice: '1.0' })).status
    ).toBe(400);
    expect((await post('/cert/other', {})).status).toBe(404);
    const get = await handle(new Request('https://robotsforall.org.za/cert/name'), env, {
      fetch: fakeFetch,
      now: () => NOW
    });
    expect(get.status).toBe(405);
    expect(stored).toBeNull();
  });

  it('shows a class’s names to its teacher, decrypted here', async () => {
    await post('/cert/name', { learner: LEARNER, name: 'Sipho Mokoena', notice: '1.0' });
    const sealed = String(stored?.['p_name']);
    dbReply = () =>
      Response.json([
        { learner_id: LEARNER, certificate_name: sealed, key_version: 1 },
        // Moved onto another learner: does not decrypt, so it is left out.
        {
          learner_id: '55555555-5555-4555-8555-555555555555',
          certificate_name: sealed,
          key_version: 1
        }
      ]);
    const res = await post('/cert/show-names', { class: CLASS });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ names: [{ learner: LEARNER, name: 'Sipho M.' }] });
    const db = calls.find((c) => c.url.endsWith('/rpc/reveal_class_names'));
    expect(JSON.parse(String(db?.init?.body))).toEqual({ p_class: CLASS, p_by: USER });
  });

  it('shortens a certificate name to first name + initial', () => {
    expect(shortName('Sipho Mokoena')).toBe('Sipho M.');
    expect(shortName('  Thandiwe  Nomsa   radebe ')).toBe('Thandiwe R.');
    expect(shortName('Lerato')).toBe('Lerato');
    expect(shortName('   ')).toBe('');
  });

  it('needs a recent sign-in to show names', async () => {
    const old = jwt(NOW / 1000 - RECENT_SIGN_IN - 1);
    const res = await post('/cert/show-names', { class: CLASS }, old);
    expect(res.status).toBe(401);
    expect(calls.some((c) => c.url.endsWith('/rpc/reveal_class_names'))).toBe(false);
  });

  it('passes on the database’s refusal (not this class’s teacher, or not verified)', async () => {
    dbReply = () =>
      Response.json({ message: 'only the class’s teachers can see names' }, { status: 403 });
    const res = await post('/cert/show-names', { class: CLASS });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: 'only the class’s teachers can see names' });
  });
});
