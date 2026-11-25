// Awarding badges (M5 step 7b).
import { beforeEach, describe, expect, it } from 'vitest';
import { checkLearner, forgetBadgeIndex, lessonResults } from './badges';
import { type Env, handle } from './handler';
import type { Mailer } from './mail';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: Buffer.alloc(32, 1).toString('base64') }),
  NAME_KEY_CURRENT: '1',
  SITE_URL: 'https://robotsforall.org.za'
};
const INDEX = {
  badges: [
    { id: 'first-build', rule: { kind: 'lessons_done', count: 1 } },
    { id: 'lever-master', rule: { kind: 'mechanism_done', mechanism: 'lever' } }
  ],
  lessons: [
    { id: 'p1-crank-01', phase: 1, mechanism: 'crank' },
    { id: 'p1-lever-01', phase: 1, mechanism: 'lever' }
  ],
  boxes: { 'p1-crank-01-81feed': 10 }
};
const rec = (over: Record<string, unknown> = {}) => ({
  lesson_id: 'p1-crank-01',
  sheet_code: 'p1-crank-01-81feed',
  steps_done: 10,
  i_can: [true, true],
  built_working: true,
  recorded_at: '2026-11-25T10:00:00Z',
  ...over
});

let records: Record<string, unknown>[];
let awarded: Set<string>;
let calls: { fn: string; auth: string | null }[];
let mail: { to: string; subject: string; text: string }[];
const mailer: Mailer = {
  send: async (to, subject, text) => {
    mail.push({ to, subject, text });
    return true;
  }
};
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith('/badges.json')) return Response.json(INDEX);
  const fn = /\/rpc\/(\w+)$/.exec(url)?.[1] ?? '';
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  calls.push({ fn, auth: new Headers(init?.headers).get('authorization') });
  switch (fn) {
    case 'whoami_learner':
      return Response.json(
        new Headers(init?.headers).get('authorization')?.includes('good') ? LEARNER : null
      );
    case 'badge_records':
      return Response.json(records);
    case 'award_badge': {
      const id = String(body['p_badge']);
      if (awarded.has(id)) return Response.json(null);
      awarded.add(id);
      return Response.json(`award-${id}`);
    }
    case 'learner_guardian_emails':
      return Response.json([{ email: 'mom@example.org', nickname: 'Thandi R', language: 'en' }]);
    default:
      return new Response('{}', { status: 404 });
  }
}) as typeof fetch;
const deps = { fetch: fakeFetch, now: () => 1_800_000_000_000, mailer };

beforeEach(() => {
  forgetBadgeIndex();
  records = [];
  awarded = new Set();
  calls = [];
  mail = [];
});

describe('badge awarding', () => {
  it('a lesson is done only with every box, every Yes, and built and working', () => {
    const boxes = INDEX.boxes;
    expect(lessonResults([rec()], boxes)).toEqual([
      { lesson: 'p1-crank-01', allYes: true, done: true }
    ]);
    expect(lessonResults([rec({ steps_done: 9 })], boxes)[0]?.done).toBe(false);
    expect(lessonResults([rec({ i_can: [true, false] })], boxes)[0]).toMatchObject({
      done: false,
      allYes: false
    });
    expect(lessonResults([rec({ sheet_code: 'unknown' })], boxes)[0]?.done).toBe(false);
    // The newest record counts.
    expect(
      lessonResults(
        [rec(), rec({ recorded_at: '2026-11-26T10:00:00Z', built_working: false })],
        boxes
      )[0]?.done
    ).toBe(false);
  });

  it('awards what is earned once, and emails the parent with the nickname and badge name only', async () => {
    records = [rec()];
    expect(await checkLearner(LEARNER, env, deps, mailer)).toEqual(['first-build']);
    expect(await checkLearner(LEARNER, env, deps, mailer)).toEqual([]);
    expect(mail).toHaveLength(1);
    expect(mail[0]?.to).toBe('mom@example.org');
    expect(mail[0]?.subject).toBe('Thandi R earned a badge on Robots For All');
    expect(mail[0]?.text).toContain('First Build');
    expect(mail[0]?.text).toContain('https://robotsforall.org.za/account/');
  });

  it('a learner asks with their own session; the database says who they are', async () => {
    records = [rec()];
    const ask = (token: string) =>
      handle(
        new Request('https://robotsforall.org.za/cert/badges', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: '{}'
        }),
        env,
        deps
      );
    const res = await ask('a.good.token');
    expect(await res.json()).toEqual({ awarded: ['first-build'] });
    expect(calls.find((c) => c.fn === 'whoami_learner')?.auth).toBe('Bearer a.good.token');
    expect((await ask('a.bad.token')).status).toBe(401);
  });
});
