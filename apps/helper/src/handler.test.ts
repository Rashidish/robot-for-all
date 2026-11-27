// The helper service end to end with a fake database and a fake AI provider (spec §8).
import { beforeEach, describe, expect, it } from 'vitest';
import { type Env, handle } from './handler.ts';
import type { AskInput, AskOutput, Provider } from './providers/types.ts';

const ADULT = '44444444-4444-4444-8444-444444444444';
const LEARNER = '11111111-1111-4111-8111-111111111111';
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  SITE_URL: 'https://robotsforall.org.za',
  ZAR_PER_USD: '18'
};
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ADULT_TOKEN = `${b64url({ alg: 'HS256' })}.${b64url({ sub: ADULT, role: 'authenticated' })}.sig`;
const CHILD_TOKEN = `${b64url({ alg: 'HS256' })}.${b64url({ kind: 'learner', learner_id: LEARNER })}.sig`;

const LESSON = {
  id: 'p1-crank-01',
  title: 'Crank-powered waving rhino',
  grades: [3, 4],
  parts: [{ item: 'cardboard A4', qty: 2, substitute: 'cereal-box card' }],
  safety: { adult_help: true, notes: ['An adult cuts the slots.'] },
  body: '## Predict\nWhat happens when you turn the crank?'
};

let take: Record<string, unknown>;
let toDb: { fn: string; body: Record<string, unknown> }[];
let asked: AskInput[];
let reply: (input: AskInput) => AskOutput;
let failModel: string | null;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    return auth === `Bearer ${ADULT_TOKEN}`
      ? Response.json({ id: ADULT })
      : new Response('{}', { status: 401 });
  }
  if (url === 'https://robotsforall.org.za/lessons/p1-crank-01.json') return Response.json(LESSON);
  if (url.includes('/lessons/')) return new Response('', { status: 404 });
  const fn = /\/rpc\/(\w+)$/.exec(url)?.[1] ?? '';
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  toDb.push({ fn, body });
  switch (fn) {
    case 'whoami_learner':
      return Response.json(
        new Headers(init?.headers).get('authorization') === `Bearer ${CHILD_TOKEN}` ? LEARNER : null
      );
    case 'helper_take':
      return Response.json([take]);
    case 'helper_config':
      return Response.json({
        adult_model: 'claude-sonnet-5-5',
        child_model: 'claude-haiku-5-5',
        adult_prompt: 'adult-v1',
        child_prompt: 'child-v1'
      });
    default:
      return new Response(null, { status: 204 });
  }
}) as typeof fetch;

const provider = (model: string): Provider => ({
  ask: async (input) => {
    if (model === failModel) throw new Error('provider down');
    asked.push(input);
    return reply(input);
  }
});

const post = (path: string, body: unknown, token: string | null = ADULT_TOKEN, limited = false) =>
  handle(
    new Request(`https://robotsforall.org.za${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.9',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    }),
    limited ? { ...env, BY_ADDRESS: { limit: async () => ({ success: false }) } } : env,
    { fetch: fakeFetch, now: Date.now, provider }
  );
const json = async (r: Response) => (await r.json()) as { status: string; answer?: string };
const calls = (fn: string) => toDb.filter((c) => c.fn === fn);

beforeEach(() => {
  take = { allowed: true, reason: null, grade_band: null, names: ['Thandi R'] };
  toDb = [];
  asked = [];
  failModel = null;
  reply = () => ({
    text: 'Turn the crank slowly and check the straw is straight.',
    refused: false,
    usage: { input: 1000, cacheRead: 5000, cacheWrite: 0, output: 800 }
  });
});

describe('asking', () => {
  it('an adult on a lesson page gets a grounded answer; names and contacts never reach the AI', async () => {
    const r = await post('/helper/ask', {
      question: 'Thandi R says the rhino jaw sticks. Email mom@example.org or 082 555 1234',
      page: 'lesson',
      lesson: 'p1-crank-01',
      language: 'zu'
    });
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await json(r)).toEqual({
      status: 'ok',
      answer: 'Turn the crank slowly and check the straw is straight.'
    });
    const [input] = asked;
    expect(input?.model).toBe('claude-sonnet-5-5');
    expect(input?.context).toContain('Crank-powered waving rhino');
    expect(input?.context).toContain('an adult must help');
    expect(input?.turns.at(-1)?.text).toContain('Answer in isiZulu.');
    const sent = JSON.stringify(asked);
    expect(sent).not.toMatch(/Thandi|mom@|555 1234|44444444/);
    // The database was told who asked (to count), never what.
    expect(calls('helper_take')[0]?.body).toEqual({
      p_adult: ADULT,
      p_learner: null,
      p_on_lesson: true
    });
    expect(JSON.stringify(toDb)).not.toMatch(/jaw|mom@|555/);
    // Sonnet 5.5: 1000×2 + 5000×0.1 + 800×10 per million dollars ≈ $0.0105 → 19 cents.
    expect(calls('helper_record')[0]?.body).toEqual({
      p_subject: ADULT,
      p_audience: 'adult',
      p_refused: false,
      p_blocked: false,
      p_cost_cents: 19
    });
  });

  it('passes on why not, without calling the AI', async () => {
    take = { allowed: false, reason: 'daily_cap', grade_band: null, names: null };
    expect(await json(await post('/helper/ask', { question: 'Why gears?', page: 'home' }))).toEqual(
      {
        status: 'daily_cap'
      }
    );
    expect(asked).toEqual([]);
  });

  it('refuses without a session, a bad request, or too many from one address', async () => {
    expect((await post('/helper/ask', { question: 'x', page: 'home' }, null)).status).toBe(401);
    expect((await post('/helper/ask', { question: 'x', page: 'nowhere' })).status).toBe(400);
    expect((await post('/helper/ask', { question: 'x'.repeat(501), page: 'home' })).status).toBe(
      400
    );
    expect(
      (await post('/helper/ask', { question: 'x', page: 'home' }, ADULT_TOKEN, true)).status
    ).toBe(429);
  });

  it('a child asks only on a lesson page; their grade band goes, their program does not', async () => {
    expect(
      await json(await post('/helper/ask', { question: 'Why?', page: 'home' }, CHILD_TOKEN))
    ).toEqual({ status: 'lesson_only' });
    expect(calls('helper_take')).toEqual([]);
    expect(
      await json(
        await post(
          '/helper/ask',
          { question: 'Why?', page: 'lesson', lesson: 'nope-lesson' },
          CHILD_TOKEN
        )
      )
    ).toEqual({ status: 'lesson_only' });
    take = { allowed: true, reason: null, grade_band: '3-4', names: ['Thandi R', 'Rocket'] };
    const r = await post(
      '/helper/ask',
      {
        question: 'Rocket and me cant make the jaw move',
        page: 'lesson',
        lesson: 'p1-crank-01',
        program: { blocks: [{ type: 'robot_forward' }] }
      },
      CHILD_TOKEN
    );
    expect((await json(r)).status).toBe('ok');
    const [input] = asked;
    expect(input?.model).toBe('claude-haiku-5-5');
    expect(input?.system).toContain('ask your teacher or parent');
    expect(input?.turns.at(-1)?.text).toContain('Grade band: 3-4.');
    expect(input?.turns.at(-1)?.text).not.toContain('Rocket');
    expect(input?.context).not.toContain('robot_forward');
    expect(calls('helper_take')[0]?.body).toMatchObject({ p_learner: LEARNER, p_on_lesson: true });
  });

  it('a child who sounds unsafe gets the trusted-adult answer at once; nothing is asked or counted', async () => {
    const r = await post(
      '/helper/ask',
      { question: 'my uncle hits me', page: 'lesson', lesson: 'p1-crank-01' },
      CHILD_TOKEN
    );
    expect(await json(r)).toEqual({ status: 'safety' });
    expect(asked).toEqual([]);
    expect(calls('helper_take')).toEqual([]);
  });

  it('counts a refusal; replaces an unsafe or empty answer', async () => {
    reply = () => ({
      text: '',
      refused: true,
      usage: { input: 10, cacheRead: 0, cacheWrite: 0, output: 1 }
    });
    expect(
      (await json(await post('/helper/ask', { question: 'How do I wire mains?', page: 'home' })))
        .status
    ).toBe('refused');
    expect(calls('helper_record')[0]?.body).toMatchObject({ p_refused: true });
    reply = () => ({
      text: 'Plug it into the wall socket. Also see https://example.com',
      refused: false,
      usage: { input: 10, cacheRead: 0, cacheWrite: 0, output: 10 }
    });
    expect(
      await json(await post('/helper/ask', { question: 'More power?', page: 'home' }))
    ).toEqual({
      status: 'blocked'
    });
    expect(calls('helper_record')[1]?.body).toMatchObject({ p_blocked: true, p_refused: false });
  });

  it('falls back to Claude Haiku 5.5 once if the chosen model fails', async () => {
    failModel = 'claude-sonnet-5-5';
    expect(
      (await json(await post('/helper/ask', { question: 'Why gears?', page: 'home' }))).status
    ).toBe('ok');
    expect(asked[0]?.model).toBe('claude-haiku-5-5');
    failModel = 'claude-haiku-5-5';
    take = { allowed: true, reason: null, grade_band: '5-6', names: [] };
    expect(
      (
        await json(
          await post(
            '/helper/ask',
            { question: 'Why?', page: 'lesson', lesson: 'p1-crank-01' },
            CHILD_TOKEN
          )
        )
      ).status
    ).toBe('unavailable');
  });

  it('a follow-up carries the earlier question and answer, both stripped', async () => {
    await post('/helper/ask', {
      question: 'And for Grade 6?',
      page: 'home',
      earlier: { question: 'How do I teach levers to Thandi R?', answer: 'Use a ruler.' }
    });
    expect(asked[0]?.turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(JSON.stringify(asked[0]?.turns)).not.toContain('Thandi');
  });
});

describe('Common questions', () => {
  it('are public, per language, and a signed-in 👎 is counted once per person', async () => {
    const get = (path: string) =>
      handle(new Request(`https://robotsforall.org.za${path}`), env, {
        fetch: fakeFetch,
        now: Date.now,
        provider
      });
    const r = await get('/helper/faq/p1-crank-01?lang=zu');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('public, max-age=300');
    expect(calls('helper_faq_for')[0]?.body).toEqual({ p_lesson: 'p1-crank-01', p_language: 'zu' });
    expect((await get('/helper/faq/p1-crank-01?lang=ZU1')).status).toBe(400);
    expect((await get('/helper/faq/../secret')).status).toBe(405);

    expect(
      await json(await post('/helper/faq-down', { lesson: 'p1-crank-01', language: 'en', item: 2 }))
    ).toEqual({
      status: 'ok',
      hidden: false
    });
    expect(calls('helper_faq_down')[0]?.body).toEqual({
      p_lesson: 'p1-crank-01',
      p_language: 'en',
      p_item: 2,
      p_subject: ADULT
    });
    expect(
      (await post('/helper/faq-down', { lesson: 'p1-crank-01', language: 'en', item: 9 })).status
    ).toBe(400);
    expect(
      (await post('/helper/faq-down', { lesson: 'p1-crank-01', language: 'en', item: 1 }, null))
        .status
    ).toBe(401);
  });
});

describe('thumbs', () => {
  it('counts 👍 or 👎 by audience, nothing else', async () => {
    expect(await json(await post('/helper/thumb', { up: false }, CHILD_TOKEN))).toEqual({
      status: 'ok'
    });
    expect(calls('helper_thumb')[0]?.body).toEqual({ p_audience: 'child', p_up: false });
    expect((await post('/helper/thumb', { up: 'yes' })).status).toBe(400);
  });
});
