// Certificate and badge-card PDFs (M5 step 8b).
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { encryptName, loadKeys, toBytea } from './crypto';
import { type Env, handle } from './handler';
import { drawableSvg, svgShapes } from './svg';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const AWARD = '22222222-2222-4222-8222-222222222222';
const CLASS = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const NOW = 1_800_000_000_000;
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: Buffer.alloc(32, 3).toString('base64') }),
  NAME_KEY_CURRENT: '1',
  SITE_URL: 'https://robotsforall.org.za'
};
const fonts = () =>
  Promise.resolve({
    regular: new Uint8Array(readFileSync('apps/cert/fonts/NotoSans-Regular.ttf')),
    bold: new Uint8Array(readFileSync('apps/cert/fonts/NotoSans-Bold.ttf'))
  });
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64url({ alg: 'HS256' })}.${b64url({ sub: USER, amr: [{ timestamp: NOW / 1000 }] })}.sig`;

let rows: Record<string, unknown>[];
let calls: string[];
let issued: unknown[];
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith('/auth/v1/user'))
    return Response.json({ id: USER, email: 'parent@example.org' });
  if (url.endsWith('.svg'))
    return new Response(readFileSync('content/badges/lever-master.svg', 'utf8'));
  const fn = /\/rpc\/(\w+)$/.exec(url)?.[1] ?? '';
  calls.push(fn);
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  switch (fn) {
    case 'certificates_for':
      return Response.json(body['p_by'] === USER ? rows : []);
    case 'certificate_label':
      return Response.json('Sizwe Primary');
    case 'issue_certificate_code':
      issued.push(body);
      return Response.json('RFA-NEWC-23');
    case 'verify_certificate':
      return Response.json([{ issued_by_label: 'Sizwe Primary' }]);
    default:
      return new Response('{}', { status: 404 });
  }
}) as typeof fetch;

const post = (path: string, body: unknown) =>
  handle(
    new Request(`https://robotsforall.org.za${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body)
    }),
    env,
    { fetch: fakeFetch, now: () => NOW, fonts }
  );

const row = async (over: Record<string, unknown> = {}) => {
  const key = (await loadKeys(env.NAME_KEYS)).get(1);
  if (!key) throw new Error('no key');
  return {
    award_id: AWARD,
    learner_id: LEARNER,
    badge_id: 'lever-master',
    awarded_at: '2026-11-25T10:00:00Z',
    code: 'RFA-ABCD-23',
    certificate_name: toBytea(await encryptName(key, LEARNER, 'Thandiwe Radebe')),
    key_version: 1,
    language: 'zu',
    ...over
  };
};

beforeEach(() => {
  rows = [];
  calls = [];
  issued = [];
});

describe('badge pictures in PDFs', () => {
  it('every badge picture uses only shapes the PDF can draw', () => {
    for (const id of ['first-build', 'i-can', 'cardboard-builder', 'lever-master', 'robot-coder']) {
      const svg = readFileSync(`content/badges/${id}.svg`, 'utf8');
      expect(drawableSvg(svg)).toBe(true);
      expect(svgShapes(svg).shapes.length).toBeGreaterThan(3);
    }
    expect(drawableSvg('<svg><text>hi</text></svg>')).toBe(false);
  });
});

describe('certificate PDFs', () => {
  it('a parent gets their child’s certificate: a one-page PDF, never stored, no name in the file name', async () => {
    rows = [await row()];
    const res = await post('/cert/certificate', { award: AWARD, kind: 'certificate' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="certificates.pdf"');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    // Small enough for a phone on low data.
    expect(bytes.length).toBeLessThan(40_000);
  });

  it('badge cards for a class: four to a page; a missing code is issued first', async () => {
    rows = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        row({ award_id: `${AWARD.slice(0, -1)}${i}`, code: i === 0 ? null : 'RFA-ABCD-23' })
      )
    );
    const res = await post('/cert/certificates', { class: CLASS, kind: 'card' });
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="badge-cards.pdf"');
    expect((await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))).getPageCount()).toBe(
      2
    );
    expect(issued).toEqual([{ p_award: `${AWARD.slice(0, -1)}0`, p_label: 'Sizwe Primary' }]);
  });

  it('without the name consent the certificate prints with a blank line', async () => {
    rows = [await row({ certificate_name: null, key_version: null })];
    const res = await post('/cert/certificate', { award: AWARD });
    expect(res.status).toBe(200);
  });

  it('refuses what is not yours, and says so without echoing anything', async () => {
    const res = await post('/cert/certificate', { award: AWARD, kind: 'certificate' });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/Thandi/);
    expect((await post('/cert/certificate', { award: 'nope' })).status).toBe(400);
    expect((await post('/cert/certificates', { class: CLASS, badge: 'Bad Badge' })).status).toBe(
      400
    );
  });
});
