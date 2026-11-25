// School enrolment through the certificate service (M5 step 4b, FR-5a).
import { beforeEach, describe, expect, it } from 'vitest';
import { decryptName, fromBytea, loadKeys } from './crypto';
import { type Env, handle, MAX_ENROL, tokenHash } from './handler';
import type { Mailer } from './mail';

const CLASS = '33333333-3333-4333-8333-333333333333';
const TEACHER = '44444444-4444-4444-8444-444444444444';
const PARENT = '66666666-6666-4666-8666-666666666666';
const LEARNER = '11111111-1111-4111-8111-111111111111';
const NOW = 1_800_000_000_000;
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: Buffer.alloc(32, 9).toString('base64') }),
  NAME_KEY_CURRENT: '1'
};
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (who: string) =>
  `${b64url({ alg: 'HS256' })}.${b64url({ sub: who, amr: [{ timestamp: NOW / 1000 }] })}.sig`;
const USERS: Record<string, { id: string; email: string }> = {
  [jwt(TEACHER)]: { id: TEACHER, email: 'teacher@school.example' },
  [jwt(PARENT)]: { id: PARENT, email: 'mom@example.org' }
};

let pending: Record<string, unknown>[];
let mail: { to: string; subject: string; text: string }[];
let calls: { fn: string; body: Record<string, unknown>; auth: string | null }[];
let mailWorks: boolean;

const mailer: Mailer = {
  send: async (to, subject, text) => {
    mail.push({ to, subject, text });
    return mailWorks;
  }
};

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = new Headers(init?.headers);
  if (url.endsWith('/auth/v1/user')) {
    const user = USERS[(headers.get('authorization') ?? '').slice(7)];
    return user ? Response.json(user) : new Response('{}', { status: 401 });
  }
  const fn = /\/rpc\/(\w+)$/.exec(url)?.[1] ?? '';
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  calls.push({ fn, body, auth: headers.get('authorization') });
  switch (fn) {
    case 'class_label':
      return Response.json([
        { class_name: 'Grade 4B', organisation_name: 'Sizwe Primary', language: 'en' }
      ]);
    case 'create_pending_enrolment':
      pending.push({ id: `p${pending.length}`, ...body });
      return Response.json(`p${pending.length - 1}`);
    case 'drop_pending_enrolment':
      pending = pending.filter((p) => p['id'] !== body['p_id']);
      return new Response(null, { status: 204 });
    case 'pending_for_token': {
      const p = pending.find((x) => x['p_token_hash'] === body['p_hash']);
      return Response.json(
        p
          ? [
              {
                id: p['id'],
                class_id: CLASS,
                class_name: 'Grade 4B',
                organisation_name: 'Sizwe Primary',
                grade: p['p_grade'],
                certificate_name: p['p_name'],
                certificate_name_key_version: 1,
                parent_contact: p['p_contact'],
                parent_contact_key_version: 1
              }
            ]
          : []
      );
    }
    case 'confirm_enrolment':
      return Response.json(LEARNER);
    case 'set_certificate_name':
      return new Response(null, { status: 204 });
    default:
      return new Response('{}', { status: 404 });
  }
}) as typeof fetch;

const post = (path: string, body: unknown, who = TEACHER, withMailer: Mailer | null = mailer) =>
  handle(
    new Request(`https://robotsforall.org.za${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt(who)}` },
      body: JSON.stringify(body)
    }),
    env,
    { fetch: fakeFetch, now: () => NOW, mailer: withMailer }
  );

const learners = [
  { name: 'Thandiwe Radebe', grade: 4, email: 'Mom@Example.org ' },
  { name: 'Sipho Mokoena', grade: 4, email: 'dad@example.org' }
];

beforeEach(() => {
  pending = [];
  mail = [];
  calls = [];
  mailWorks = true;
});

describe('a school enrols learners for their parents to confirm', () => {
  it('locks each name and email, and emails each parent a link without the child’s name', async () => {
    const res = await post('/cert/enrol', { class: CLASS, learners });
    expect(await res.json()).toEqual({ sent: 2, failed: [] });
    expect(JSON.stringify(pending)).not.toMatch(/Thandiwe|Sipho|example\.org/);
    expect(mail.map((m) => m.to)).toEqual(['mom@example.org', 'dad@example.org']);
    for (const m of mail) {
      expect(m.text).toContain('Sizwe Primary');
      expect(m.text).toMatch(/https:\/\/robotsforall\.org\.za\/enrol\/confirm\/#[0-9a-f]{64}/);
      expect(m.text + m.subject).not.toMatch(/Thandiwe|Sipho/);
    }
    // The database keeps only the hash of the link's secret.
    const token = /#([0-9a-f]{64})/.exec(mail[0]?.text ?? '')?.[1] ?? '';
    expect(pending[0]?.['p_token_hash']).toBe(await tokenHash(token));
    expect(JSON.stringify(pending)).not.toContain(token);
  });

  it('stores nothing when email is not set up, or when any row is wrong', async () => {
    const none = await post('/cert/enrol', { class: CLASS, learners }, TEACHER, null);
    expect(none.status).toBe(503);
    const bad = await post('/cert/enrol', {
      class: CLASS,
      learners: [learners[0], { name: 'Sipho 2', grade: 4, email: 'not-an-email' }]
    });
    expect(bad.status).toBe(422);
    const body = await bad.text();
    expect(JSON.parse(body)).toEqual({ message: 'rows', rows: [1] });
    expect(body).not.toContain('Sipho');
    const tooMany = await post('/cert/enrol', {
      class: CLASS,
      learners: Array.from({ length: MAX_ENROL + 1 }, () => learners[0])
    });
    expect(tooMany.status).toBe(400);
    expect(pending).toEqual([]);
    expect(mail).toEqual([]);
  });

  it('drops a request whose email the provider refused', async () => {
    mailWorks = false;
    const res = await post('/cert/enrol', { class: CLASS, learners: [learners[0]] });
    expect(await res.json()).toEqual({ sent: 0, failed: [0] });
    expect(pending).toEqual([]);
  });

  it('the parent named by the school sees the class, confirms, and the name moves to the child', async () => {
    await post('/cert/enrol', { class: CLASS, learners: [learners[0]] });
    const token = /#([0-9a-f]{64})/.exec(mail[0]?.text ?? '')?.[1] ?? '';

    // Someone else signed in with the forwarded link is refused.
    expect((await post('/cert/pending', { token }, TEACHER)).status).toBe(403);

    const seen = await post('/cert/pending', { token }, PARENT);
    expect(await seen.json()).toEqual({
      class_name: 'Grade 4B',
      organisation_name: 'Sizwe Primary',
      grade: 4
    });

    const res = await post(
      '/cert/confirm',
      {
        token,
        nickname: 'Thandi R',
        avatar: 'rocket',
        language: 'zu',
        notice: '1.0',
        keep_name: true
      },
      PARENT
    );
    expect(await res.json()).toEqual({ learner: LEARNER, name_kept: true });
    // Confirmed as the parent (their own token), so the database's checks apply to them.
    const confirmCall = calls.find((c) => c.fn === 'confirm_enrolment');
    expect(confirmCall?.auth).toBe(`Bearer ${jwt(PARENT)}`);
    expect(confirmCall?.body).toMatchObject({
      p_token: token,
      p_nickname: 'Thandi R',
      p_keep_name: false
    });
    // The name is locked again to the child's own profile.
    const setName = calls.find((c) => c.fn === 'set_certificate_name');
    const key = (await loadKeys(env.NAME_KEYS)).get(1);
    if (!key) throw new Error('no key');
    expect(await decryptName(key, LEARNER, fromBytea(String(setName?.body['p_name'])))).toBe(
      'Thandiwe Radebe'
    );
  });

  it('without consent to keep the name, no name is stored', async () => {
    await post('/cert/enrol', { class: CLASS, learners: [learners[0]] });
    const token = /#([0-9a-f]{64})/.exec(mail[0]?.text ?? '')?.[1] ?? '';
    const res = await post(
      '/cert/confirm',
      {
        token,
        nickname: 'Thandi R',
        avatar: 'rocket',
        language: 'en',
        notice: '1.0',
        keep_name: false
      },
      PARENT
    );
    expect(await res.json()).toEqual({ learner: LEARNER, name_kept: false });
    expect(calls.some((c) => c.fn === 'set_certificate_name')).toBe(false);
  });

  it('an unknown or expired link says so', async () => {
    expect((await post('/cert/pending', { token: 'f'.repeat(64) }, PARENT)).status).toBe(404);
    expect((await post('/cert/pending', { token: 'short' }, PARENT)).status).toBe(400);
  });
});
