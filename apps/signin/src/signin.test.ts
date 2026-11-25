import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Env, handle, type RateLimiter } from './handler';
import { learnerToken, SESSION_SECONDS } from './jwt';
import { checkPin, hashPin, validPin } from './pin';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const NOW = 1_800_000_000_000;
const SECRET = 'super-secret-jwt-signing-key-for-tests-only';
const CARD = 'ab'.repeat(32);
const CARD_HASH = createHash('sha256').update(CARD).digest('hex');
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_KEY: 'service',
  SUPABASE_JWT_SECRET: SECRET
};

let row: Record<string, unknown>;
let calls: { fn: string; body: Record<string, unknown> }[];
let failures: number;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const fn = /\/rpc\/(\w+)$/.exec(String(input))?.[1] ?? '';
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  calls.push({ fn, body });
  switch (fn) {
    case 'sign_in_roster':
      return Response.json([{ learner_id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' }]);
    case 'learner_for_sign_in':
      return Response.json(body['p_learner'] === LEARNER ? [row] : []);
    case 'choose_learner_pin':
      if (row['pin_hash'] !== null) return Response.json(false);
      row['pin_hash'] = body['p_hash'];
      return Response.json(true);
    case 'card_for_sign_in':
      return Response.json(body['p_hash'] === CARD_HASH ? [{ ...row, learner_id: LEARNER }] : []);
    case 'record_pin_attempt':
      if (body['p_ok']) failures = 0;
      else failures += 1;
      return Response.json(failures < 5);
    default:
      return new Response('{}', { status: 404 });
  }
}) as typeof fetch;

const post = (path: string, body: unknown, e: Env = env) =>
  handle(
    new Request(`https://robotsforall.org.za${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7' },
      body: JSON.stringify(body)
    }),
    e,
    { fetch: fakeFetch, now: () => NOW }
  );

const claims = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as Record<
    string,
    unknown
  >;

beforeEach(() => {
  calls = [];
  failures = 0;
  row = {
    learner_id: LEARNER,
    nickname: 'Thandi R',
    avatar: 'rocket',
    pin_hash: null,
    locked_until: null,
    session_version: 3
  };
});

describe('picture PINs', () => {
  it('accepts exactly 4 pictures of 9', () => {
    expect(validPin([0, 8, 3, 3])).toBe(true);
    for (const bad of [[0, 1, 2], [0, 1, 2, 9], [0, 1, 2, -1], [0, 1, 2, 1.5], '0123', null]) {
      expect(validPin(bad)).toBe(false);
    }
  });

  it('hashes with a salt, bound to the learner', async () => {
    const a = await hashPin([1, 2, 3, 4], LEARNER);
    expect(a).not.toBe(await hashPin([1, 2, 3, 4], LEARNER));
    expect(a).not.toContain('1234');
    expect(await checkPin([1, 2, 3, 4], LEARNER, a)).toBe(true);
    expect(await checkPin([1, 2, 3, 5], LEARNER, a)).toBe(false);
    expect(await checkPin([1, 2, 3, 4], '22222222-2222-4222-8222-222222222222', a)).toBe(false);
  });
});

describe('the learner session', () => {
  it('is a 30-day token for one learner, accepted by the database, and nothing else', async () => {
    const { token, expiresAt } = await learnerToken(SECRET, LEARNER, 3, NOW / 1000);
    expect(expiresAt).toBe(NOW / 1000 + SESSION_SECONDS);
    expect(claims(token)).toEqual({
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'robotsforall-signin',
      kind: 'learner',
      learner_id: LEARNER,
      sv: 3,
      iat: NOW / 1000,
      exp: expiresAt
    });
    // Signed with the secret: checkable with Web Crypto, as Supabase does.
    const [h, b, s] = token.split('.');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    expect(
      await crypto.subtle.verify(
        'HMAC',
        key,
        Buffer.from(s ?? '', 'base64url'),
        new TextEncoder().encode(`${h}.${b}`)
      )
    ).toBe(true);
  });
});

describe('the sign-in service', () => {
  it('lists the class by nickname and picture', async () => {
    const res = await post('/signin/roster', { class_code: 'bcd fgh' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      learners: [{ learner_id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' }]
    });
    expect(calls[0]?.body).toEqual({ p_class_code: 'bcdfgh' });
    expect((await post('/signin/roster', { class_code: 'AEIOU1' })).status).toBe(400);
  });

  it('first time: the learner chooses a PIN, then signs in with it', async () => {
    const first = await post('/signin/pin', {
      class_code: 'BCDFGH',
      learner: LEARNER,
      pin: [1, 2, 3, 4]
    });
    expect(first.status).toBe(409);
    const chose = await post('/signin/pin', {
      class_code: 'BCDFGH',
      learner: LEARNER,
      pin: [1, 2, 3, 4],
      choose: true
    });
    expect(chose.status).toBe(200);
    const body = (await chose.json()) as { token: string; learner: unknown };
    expect(claims(body.token)['sv']).toBe(3);
    expect(body.learner).toEqual({ id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' });
    expect(String(row['pin_hash'])).toMatch(/^pbkdf2\$/);
    const again = await post('/signin/pin', {
      class_code: 'BCDFGH',
      learner: LEARNER,
      pin: [1, 2, 3, 4]
    });
    expect(again.status).toBe(200);
  });

  it('a wrong PIN is refused; the fifth locks the learner', async () => {
    row['pin_hash'] = await hashPin([1, 2, 3, 4], LEARNER);
    for (let i = 0; i < 4; i++) {
      expect(
        (await post('/signin/pin', { class_code: 'BCDFGH', learner: LEARNER, pin: [4, 3, 2, 1] }))
          .status
      ).toBe(401);
    }
    expect(
      (await post('/signin/pin', { class_code: 'BCDFGH', learner: LEARNER, pin: [4, 3, 2, 1] }))
        .status
    ).toBe(423);
    // While the database says locked, even the right PIN waits.
    row['locked_until'] = new Date(NOW + 60_000).toISOString();
    expect(
      (await post('/signin/pin', { class_code: 'BCDFGH', learner: LEARNER, pin: [1, 2, 3, 4] }))
        .status
    ).toBe(423);
  });

  it('refuses a learner who is not on this class’s roster, bad input and other methods', async () => {
    expect(
      (
        await post('/signin/pin', {
          class_code: 'BCDFGH',
          learner: '99999999-9999-4999-8999-999999999999',
          pin: [1, 2, 3, 4]
        })
      ).status
    ).toBe(404);
    expect(
      (await post('/signin/pin', { class_code: 'BCDFGH', learner: LEARNER, pin: [1, 2] })).status
    ).toBe(400);
    const get = await handle(new Request('https://robotsforall.org.za/signin/roster'), env, {
      fetch: fakeFetch,
      now: () => NOW
    });
    expect(get.status).toBe(405);
  });

  it('rate-limits by address and by class', async () => {
    const seen: string[] = [];
    const full: RateLimiter = {
      limit: async ({ key }) => {
        seen.push(key);
        return { success: !key.startsWith('c:') };
      }
    };
    const res = await post(
      '/signin/roster',
      { class_code: 'bcdfgh' },
      { ...env, BY_ADDRESS: full, BY_CLASS: full }
    );
    expect(res.status).toBe(429);
    expect(seen).toEqual(['a:198.51.100.7', 'c:BCDFGH']);
    expect(calls).toEqual([]);
  });

  it('signs a learner in with a live QR card; anything else is refused', async () => {
    const res = await post('/signin/card', { secret: CARD });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; learner: { nickname: string } };
    expect(claims(body.token)['learner_id']).toBe(LEARNER);
    expect(body.learner.nickname).toBe('Thandi R');
    expect((await post('/signin/card', { secret: 'cd'.repeat(32) })).status).toBe(404);
    expect((await post('/signin/card', { secret: 'short' })).status).toBe(400);
  });
});
