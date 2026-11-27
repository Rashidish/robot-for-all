// The name-leak test (ADR-0015 "Tests", M5 acceptance criterion): a child's certificate name and
// a parent's email go through the whole certificate service (a school enrols the child, the
// parent opens the link and confirms, replaces the name, the teacher taps Show names, a
// certificate is printed, the daily job runs and the name key is rotated) and are then searched
// for in everything that left the Worker: what the database was sent and kept, the Worker's
// console (its logs), emails and every response. The only places a name may appear are the
// teacher's Show names reply (ADR-0015 amendment 1) and the certificate PDF. The browser side
// (localStorage, sessionStorage, IndexedDB, caches) is checked by tests/e2e/names.spec.ts.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDaily } from './daily';
import { type Env, handle } from './handler';
import type { Mailer } from './mail';

const CLASS = '33333333-3333-4333-8333-333333333333';
const TEACHER = '44444444-4444-4444-8444-444444444444';
const PARENT = '66666666-6666-4666-8666-666666666666';
const LEARNER = '11111111-1111-4111-8111-111111111111';
const AWARD = '22222222-2222-4222-8222-222222222222';
const NOW = 1_800_000_000_000;
const FIRST = 'Nomvula Khumalo';
const SECOND = 'Nomvula Zungu';
const EMAIL = 'mom@example.org';

const env1: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: Buffer.alloc(32, 11).toString('base64') }),
  NAME_KEY_CURRENT: '1',
  SITE_URL: 'https://robotsforall.org.za',
  PRIVACY_NOTICE_EMAIL: 'io@robotsforall.org.za'
};
// The owner adds key 2 and makes it current (docs/deploy.md §7).
const env2: Env = {
  ...env1,
  NAME_KEYS: JSON.stringify({
    1: Buffer.alloc(32, 11).toString('base64'),
    2: Buffer.alloc(32, 12).toString('base64')
  }),
  NAME_KEY_CURRENT: '2'
};

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (who: string) =>
  `${b64url({ alg: 'HS256' })}.${b64url({ sub: who, amr: [{ timestamp: NOW / 1000 }] })}.sig`;
const USERS: Record<string, { id: string; email: string }> = {
  [jwt(TEACHER)]: { id: TEACHER, email: 'teacher@school.example' },
  [jwt(PARENT)]: { id: PARENT, email: EMAIL }
};
const fonts = () =>
  Promise.resolve({
    regular: new Uint8Array(readFileSync('apps/cert/fonts/NotoSans-Regular.ttf')),
    bold: new Uint8Array(readFileSync('apps/cert/fonts/NotoSans-Bold.ttf'))
  });

// --- The database, as far as the certificate service sees it ------------------------------------
interface Pending {
  id: string;
  hash: string;
  name: string;
  nameKey: number;
  contact: string;
  contactKey: number;
  token: string | null;
  tokenKey: number | null;
}
let pending: Pending[];
let learnerName: { bytes: string; key: number } | null;
/** Every request body the database received. */
let toDatabase: string[];
let mail: { to: string; subject: string; text: string }[];
/** Every response the Worker sent, as text (PDFs noted by size only). */
let replies: { path: string; text: string }[];
let logged: string[];

const mailer: Mailer = {
  send: async (to, subject, text) => {
    mail.push({ to, subject, text });
    return true;
  }
};

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = new Headers(init?.headers);
  if (url.endsWith('/auth/v1/user')) {
    const user = USERS[(headers.get('authorization') ?? '').slice(7)];
    return user ? Response.json(user) : new Response('{}', { status: 401 });
  }
  if (url.endsWith('.svg'))
    return new Response(readFileSync('content/badges/lever-master.svg', 'utf8'));
  const fn = /\/rpc\/(\w+)$/.exec(url)?.[1] ?? '';
  const raw = String(init?.body ?? '{}');
  toDatabase.push(raw);
  const b = JSON.parse(raw) as Record<string, unknown>;
  switch (fn) {
    case 'class_label':
      return Response.json([
        { class_name: 'Grade 4B', organisation_name: 'Sizwe Primary', language: 'en' }
      ]);
    case 'create_pending_enrolment': {
      const id = `p${pending.length}`;
      pending.push({
        id,
        hash: String(b['p_token_hash']),
        name: String(b['p_name']),
        nameKey: Number(b['p_name_key']),
        contact: String(b['p_contact']),
        contactKey: Number(b['p_contact_key']),
        token: null,
        tokenKey: null
      });
      return Response.json(id);
    }
    case 'store_pending_token': {
      const p = pending.find((x) => x.id === b['p_id']);
      if (p) {
        p.token = String(b['p_sealed']);
        p.tokenKey = Number(b['p_key']);
      }
      return new Response(null, { status: 204 });
    }
    case 'pending_for_token':
      return Response.json(
        pending
          .filter((p) => p.hash === b['p_hash'])
          .map((p) => ({
            id: p.id,
            class_id: CLASS,
            class_name: 'Grade 4B',
            organisation_name: 'Sizwe Primary',
            grade: 4,
            certificate_name: p.name,
            certificate_name_key_version: p.nameKey,
            parent_contact: p.contact,
            parent_contact_key_version: p.contactKey
          }))
      );
    case 'pending_reminders_due':
      return Response.json(
        pending.map((p) => ({
          id: p.id,
          class_id: CLASS,
          confirm_token_hash: p.hash,
          confirm_token_sealed: p.token,
          confirm_token_key_version: p.tokenKey,
          parent_contact: p.contact,
          parent_contact_key_version: p.contactKey
        }))
      );
    case 'confirm_enrolment':
      pending = [];
      return Response.json(LEARNER);
    case 'set_certificate_name':
      learnerName = { bytes: String(b['p_name']), key: Number(b['p_key']) };
      return new Response(null, { status: 204 });
    case 'reveal_class_names':
      return Response.json(
        learnerName
          ? [
              {
                learner_id: LEARNER,
                certificate_name: learnerName.bytes,
                key_version: learnerName.key
              }
            ]
          : []
      );
    case 'certificates_for':
      return Response.json([
        {
          award_id: AWARD,
          learner_id: LEARNER,
          badge_id: 'lever-master',
          awarded_at: '2026-11-25T10:00:00Z',
          code: 'RFA-ABCD-23',
          certificate_name: learnerName?.bytes ?? null,
          key_version: learnerName?.key ?? null,
          language: 'en'
        }
      ]);
    case 'certificate_label':
      return Response.json('Sizwe Primary');
    case 'verify_certificate':
      return Response.json([{ issued_by_label: 'Sizwe Primary' }]);
    case 'names_to_rekey':
      return Response.json(
        learnerName && learnerName.key !== Number(b['p_current'])
          ? [
              {
                kind: 'learner',
                id: LEARNER,
                token_hash: null,
                name: learnerName.bytes,
                name_key: learnerName.key,
                contact: null,
                contact_key: null,
                token: null,
                token_key: null
              }
            ]
          : []
      );
    case 'rekey_names': {
      const [r] = b['p_rows'] as Record<string, unknown>[];
      if (r && learnerName && learnerName.key === r['old_name_key']) {
        learnerName = { bytes: String(r['name']), key: Number(r['name_key']) };
        return Response.json(1);
      }
      return Response.json(0);
    }
    case 'job_due':
      return Response.json(true);
    case 'deletion_counts':
      return Response.json([{ due: 1, waiting_over_7_days: 0, locked: 0 }]);
    default:
      return Response.json(null);
  }
}) as typeof fetch;

async function post(path: string, who: string, body: unknown, env = env1) {
  const res = await handle(
    new Request(`https://robotsforall.org.za${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt(who)}` },
      body: JSON.stringify(body)
    }),
    env,
    { fetch: fakeFetch, now: () => NOW, mailer, fonts }
  );
  const pdf = res.headers.get('content-type') === 'application/pdf';
  const text = pdf ? `(PDF, ${(await res.arrayBuffer()).byteLength} bytes)` : await res.text();
  replies.push({ path, text });
  return { status: res.status, text, headers: res.headers };
}

/** The forms a word could take in what we search: as typed, upper case, hex, base64. */
const forms = (word: string) => [
  word,
  word.toUpperCase(),
  Buffer.from(word).toString('hex'),
  Buffer.from(word).toString('base64')
];
const expectNowhere = (haystack: string, words: string[]) => {
  for (const word of words) {
    for (const form of forms(word)) expect(haystack).not.toContain(form);
  }
};

beforeEach(() => {
  pending = [];
  learnerName = null;
  toDatabase = [];
  mail = [];
  replies = [];
  logged = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the certificate name never leaks (ADR-0015)', () => {
  it('through enrolment, confirming, replacing, Show names, printing, the daily job and a new key', async () => {
    // A school enrols the child; one row is wrong and is reported by number only.
    const wrong = await post('/cert/enrol', TEACHER, {
      class: CLASS,
      learners: [{ name: `${FIRST}!!`, grade: 4, email: EMAIL }]
    });
    expect(wrong.status).toBe(422);
    const enrolled = await post('/cert/enrol', TEACHER, {
      class: CLASS,
      learners: [{ name: FIRST, grade: 4, email: EMAIL }]
    });
    expect(enrolled.status).toBe(200);
    const token = /#([0-9a-f]{64})/.exec(mail[0]?.text ?? '')?.[1] ?? '';
    expect(token).toHaveLength(64);

    // The daily job reminds the parent (same link, still no name).
    await runDaily(env1, { fetch: fakeFetch, now: () => NOW, mailer });
    expect(mail.length).toBeGreaterThanOrEqual(2);

    // The parent opens the link, then confirms and keeps the school's typed name.
    expect((await post('/cert/pending', PARENT, { token })).status).toBe(200);
    // Someone else signed in with the link is refused without being told anything.
    expect((await post('/cert/pending', TEACHER, { token })).status).toBe(403);
    const confirmed = await post('/cert/confirm', PARENT, {
      token,
      notice: '1.0',
      keep_name: true,
      nickname: 'Rocket N',
      avatar: 'rocket',
      language: 'en'
    });
    expect(confirmed.status).toBe(200);
    expect(learnerName).not.toBeNull();

    // The parent replaces it; the teacher taps Show names; a certificate is printed.
    expect(
      (await post('/cert/name', PARENT, { learner: LEARNER, name: SECOND, notice: '1.0' })).status
    ).toBe(204);
    const shown = await post('/cert/show-names', TEACHER, { class: CLASS });
    // The console gets first name + initial only; the full name stays on the certificate.
    expect(shown.text).toContain('Nomvula Z.');
    expect(shown.text).not.toContain('Zungu');
    expect(shown.headers.get('cache-control')).toBe('no-store');
    const pdf = await post('/cert/certificate', PARENT, { award: AWARD, kind: 'certificate' });
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('cache-control')).toBe('no-store');
    expect(pdf.headers.get('content-disposition') ?? '').not.toMatch(/Nomvula|Zungu/i);

    // The owner rotates the key; the daily job re-locks the name; it still shows and prints.
    const report = await runDaily(env2, { fetch: fakeFetch, now: () => NOW, mailer });
    expect(report.rekeyed).toBe(1);
    expect(learnerName?.key).toBe(2);
    expect((await post('/cert/show-names', TEACHER, { class: CLASS }, env2)).text).toContain(
      'Nomvula Z.'
    );
    expect(
      (await post('/cert/certificate', PARENT, { award: AWARD, kind: 'certificate' }, env2)).status
    ).toBe(200);

    // Now search everything that left the Worker.
    const names = [FIRST, SECOND, 'Khumalo', 'Zungu'];
    expectNowhere(toDatabase.join('\n'), [...names, EMAIL]);
    expectNowhere(JSON.stringify({ pending, learnerName }), [...names, EMAIL]);
    expectNowhere(logged.join('\n'), [...names, EMAIL]);
    expectNowhere(JSON.stringify(report), [...names, EMAIL]);
    // Emails go to the parent's address but never carry the child's name.
    expectNowhere(mail.map((m) => `${m.subject}\n${m.text}`).join('\n'), names);
    // Every reply except Show names (the teacher's console) and the PDF.
    expectNowhere(
      replies
        .filter((r) => r.path !== '/cert/show-names')
        .map((r) => r.text)
        .join('\n'),
      [...names, EMAIL]
    );
  });
});
