// Common questions: parsing and checking the AI's draft, and the daily job (M6 FR-15 to FR-18, FR-21).
import { beforeEach, describe, expect, it } from 'vitest';
import type { Mailer } from '../../cert/src/mail.ts';
import { runDaily, type DailyEnv } from './daily.ts';
import { parseFaq } from './faq.ts';
import type { AskInput, Provider } from './providers/types.ts';

describe('parseFaq', () => {
  it('keeps checked questions from JSON (with or without a code fence), at most 8', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      q: `Question ${i}?`,
      a: `Answer ${i}.`
    }));
    const { items: kept, dropped } = parseFaq('```json\n' + JSON.stringify(items) + '\n```');
    expect(kept).toHaveLength(8);
    expect(kept[0]).toEqual({ q: 'Question 0?', a: 'Answer 0.' });
    expect(dropped).toBe(0);
  });

  it('drops unsafe or malformed items, and answers with links lose the link', () => {
    const { items, dropped } = parseFaq(
      JSON.stringify([
        { q: 'More power?', a: 'Plug it into the wall socket.' },
        { q: 'Which battery?', a: 'Use a CR2032 coin cell.' },
        { q: 'Who cuts?', a: 'An adult cuts the slots with a craft knife.' },
        { q: 'Where to buy?', a: 'Straws from www.shop.example.com work.' },
        { q: '', a: 'x' },
        'nonsense'
      ])
    );
    expect(items).toEqual([
      { q: 'Who cuts?', a: 'An adult cuts the slots with a craft knife.' },
      { q: 'Where to buy?', a: 'Straws from  work.' }
    ]);
    expect(dropped).toBe(4);
    expect(parseFaq('not json at all')).toEqual({ items: [], dropped: 0 });
  });
});

const LESSON = {
  id: 'p1-crank-01',
  title: 'Crank-powered waving rhino',
  grades: [4, 3],
  parts: [{ item: 'cardboard A4', qty: 2 }],
  safety: { adult_help: true, notes: ['An adult cuts the slots.'] },
  body: '## Predict\nWhat happens?',
  hash: 'aaaa1111bbbb2222'
};
const env: DailyEnv = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  SITE_URL: 'https://robotsforall.org.za',
  HELPER_NOTICE_EMAIL: 'owner@robotsforall.org.za'
};

let config: Record<string, unknown>;
let status: Record<string, number>;
let state: Record<string, unknown>[];
let stored: Record<string, unknown>[];
let records: Record<string, unknown>[];
let calls: string[];
let asked: AskInput[];
let jobDue: boolean;
let mail: { to: string; subject: string; text: string }[];
let reply: string;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url === 'https://robotsforall.org.za/helper-lessons.json') {
    return Response.json({
      languages: ['en', 'zu'],
      lessons: [
        { id: 'p1-crank-01', hash: LESSON.hash },
        { id: 'p1-cam-01', hash: 'cccc3333dddd4444' }
      ]
    });
  }
  if (url.endsWith('/lessons/p1-crank-01.json')) return Response.json(LESSON);
  if (url.endsWith('/lessons/p1-cam-01.json')) return Response.json({ ...LESSON, id: 'p1-cam-01' });
  const fn = /\/rpc\/(\w+)$/.exec(url)?.[1] ?? '';
  calls.push(fn);
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  switch (fn) {
    case 'helper_cleanup':
      return Response.json(4);
    case 'helper_config':
      return Response.json(config);
    case 'helper_month_status':
      return Response.json([status]);
    case 'helper_faq_state':
      return Response.json(state);
    case 'job_due':
      return Response.json(jobDue);
    case 'helper_faq_store':
      stored.push(body);
      return new Response(null, { status: 204 });
    case 'helper_record':
      records.push(body);
      return new Response(null, { status: 204 });
    default:
      return new Response(null, { status: 204 });
  }
}) as typeof fetch;
const provider = (): Provider => ({
  ask: async (input) => {
    asked.push(input);
    return {
      text: reply,
      refused: false,
      usage: { input: 2000, cacheRead: 0, cacheWrite: 0, output: 600 }
    };
  }
});
const mailer: Mailer = {
  send: async (to, subject, text) => {
    mail.push({ to, subject, text });
    return true;
  }
};
const run = () => runDaily(env, { fetch: fakeFetch, now: Date.now, provider, mailer });

beforeEach(() => {
  config = { enabled: true, faq_model: 'claude-haiku-5-5', faq_prompt: 'faq-v1' };
  status = { questions: 10, spend_cents: 100, month_questions: 20000, month_budget_cents: 50000 };
  state = [];
  stored = [];
  records = [];
  calls = [];
  asked = [];
  jobDue = true;
  mail = [];
  reply = JSON.stringify([
    { q: 'Why does the jaw stick?', a: 'Check the straw is straight.' },
    { q: 'No split pins?', a: 'Use straw pieces with a knot of string.' },
    { q: 'Who cuts the slots?', a: 'An adult cuts them.' }
  ]);
});

describe('the daily job', () => {
  it('drafts Common questions for every lesson and language that needs them, in that language', async () => {
    // Up to date: crank in English. Changed text: cam in English. Hidden answer: crank in isiZulu.
    state = [
      {
        lesson_id: 'p1-crank-01',
        language: 'en',
        lesson_hash: LESSON.hash,
        prompt_version: 'faq-v1',
        hidden: 0
      },
      {
        lesson_id: 'p1-crank-01',
        language: 'zu',
        lesson_hash: LESSON.hash,
        prompt_version: 'faq-v1',
        hidden: 1
      },
      {
        lesson_id: 'p1-cam-01',
        language: 'en',
        lesson_hash: 'old',
        prompt_version: 'faq-v1',
        hidden: 0
      }
    ];
    const r = await run();
    expect(r).toMatchObject({ cleaned: 4, drafted: 3, dropped: 0, skipped: null });
    expect(stored.map((s) => `${String(s['p_lesson'])}/${String(s['p_language'])}`)).toEqual([
      'p1-crank-01/zu',
      'p1-cam-01/en',
      'p1-cam-01/zu'
    ]);
    expect(stored[0]).toMatchObject({
      p_model: 'claude-haiku-5-5',
      p_prompt: 'faq-v1',
      p_hash: LESSON.hash
    });
    expect(asked[0]?.turns[0]?.text).toBe(
      'Write the common questions in isiZulu, for Grade 3 and up.'
    );
    expect(asked[0]?.system).toContain('common questions for one lesson');
    expect(asked[0]?.context).toContain('an adult must help');
    expect(records[0]).toMatchObject({ p_subject: null, p_audience: 'faq', p_refused: false });
  });

  it('keeps what it had when fewer than 3 answers pass the check', async () => {
    reply = JSON.stringify([
      { q: 'More power?', a: 'Plug it into the wall socket.' },
      { q: 'Why does it stick?', a: 'Check the straw.' }
    ]);
    const r = await run();
    expect(r).toMatchObject({ drafted: 0, dropped: 4 });
    expect(stored).toEqual([]);
    expect(records.every((x) => x['p_blocked'] === true)).toBe(true);
  });

  it('drafts nothing while the helper is off or the budget is spent; still cleans up', async () => {
    config = { ...config, enabled: false };
    expect(await run()).toMatchObject({ cleaned: 4, skipped: 'off', drafted: 0 });
    config = { ...config, enabled: true };
    status = { ...status, spend_cents: 50000 };
    expect(await run()).toMatchObject({ skipped: 'budget', drafted: 0 });
    expect(asked).toEqual([]);
  });

  it('emails the owner once at 80% and at 100% of the month (counts only)', async () => {
    status = {
      questions: 16500,
      spend_cents: 1000,
      month_questions: 20000,
      month_budget_cents: 50000
    };
    expect((await run()).notice).toBe('80');
    expect(mail[0]?.to).toBe('owner@robotsforall.org.za');
    expect(mail[0]?.subject).toContain('80%');
    expect(mail[0]?.text).toContain('16500 of 20000 questions');
    jobDue = false;
    mail = [];
    expect((await run()).notice).toBeNull();
    expect(mail).toEqual([]);
    jobDue = true;
    status = { ...status, spend_cents: 50000 };
    expect((await run()).notice).toBe('100');
  });

  it('drafts at most 10 a day', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `p1-crank-01`, hash: `h${i}` }));
    const original = fakeFetch;
    const r = await runDaily(env, {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/helper-lessons.json')
          ? Response.json({ languages: ['en'], lessons: many })
          : original(input, init)) as typeof fetch,
      now: Date.now,
      provider,
      mailer
    });
    expect(r.drafted).toBe(10);
  });
});
