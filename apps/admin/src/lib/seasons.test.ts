import { exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { GitHub, GitHubError } from './github';
import { branchFor, readSeasons, withDates } from './seasons';

const repoFile = (p: string) => readFileSync(join(import.meta.dirname, '../../../../', p), 'utf8');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

/** A pretend GitHub API: answers from a small file tree and records every call. */
function fakeGitHub(files: Record<string, string>, publicKey: CryptoKey) {
  const calls: { method: string; url: string; body: unknown; auth: string }[] = [];
  let tokens = 0;
  const fetchFn = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const auth = String((init?.headers as Record<string, string>)['Authorization'] ?? '');
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : null;
    calls.push({ method, url, body, auth });
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
    if (url.endsWith('/app/installations/42/access_tokens')) {
      const jwt = auth.replace('Bearer ', '');
      const { payload } = await jwtVerify(jwt, publicKey, { issuer: '1234' });
      expect(payload.exp).toBeDefined();
      tokens++;
      return json({
        token: `inst-${tokens}`,
        expires_at: new Date(Date.now() + 3600e3).toISOString()
      });
    }
    const path = url.replace('https://api.github.com/repos/acme/robots', '');
    if (method === 'GET' && path.startsWith('/contents/')) {
      const p = path.replace('/contents/', '').replace('?ref=main', '');
      if (p in files) return json({ content: b64(files[p] ?? ''), sha: `sha-${p}` });
      const children = Object.keys(files)
        .filter((f) => f.startsWith(`${p}/`))
        .map((f) => ({ name: f.split('/').pop(), path: f, type: 'file' }));
      return children.length ? json(children) : json({ message: 'Not Found' }, 404);
    }
    if (path === '/git/ref/heads/main') return json({ object: { sha: 'main-sha' } });
    if (path === '/git/refs' && method === 'POST') return json({}, 201);
    if (path.startsWith('/contents/') && method === 'PUT') return json({}, 200);
    if (path === '/pulls' && method === 'POST')
      return json({ html_url: 'https://github.com/acme/robots/pull/7' }, 201);
    return json({ message: 'unexpected' }, 500);
  };
  return { calls, fetchFn, tokenCount: () => tokens };
}

describe('Configuration → Seasons', () => {
  const season = repoFile('content/seasons/rhino-patrol.json');
  const files = {
    'content/seasons/rhino-patrol.json': season,
    'content/worlds/rhino-patrol.json': '{}',
    'content/worlds/rhino-patrol-junior.json': '{}',
    'content/worlds/rhino-patrol-senior.json': '{}'
  };
  let privateKey = '';
  let publicKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = await exportPKCS8(pair.privateKey);
    publicKey = pair.publicKey;
  });
  const config = () => ({ appId: '1234', privateKey, installationId: '42', repo: 'acme/robots' });

  it('reads the seasons and course ids from main through the App', async () => {
    const fake = fakeGitHub(files, publicKey);
    const gh = new GitHub(config(), fake.fetchFn);
    const { seasons, worldIds } = await readSeasons(gh);
    expect(seasons.map((s) => [s.id, s.number, s.from, s.to])).toEqual([
      ['rhino-patrol', 1, '2027-01-13', '2027-12-08']
    ]);
    expect([...worldIds].sort()).toEqual([
      'rhino-patrol',
      'rhino-patrol-junior',
      'rhino-patrol-senior'
    ]);
    // One installation token, reused for every call.
    expect(fake.tokenCount()).toBe(1);
    expect(
      fake.calls.filter((c) => c.url.includes('/repos/')).every((c) => c.auth === 'Bearer inst-1')
    ).toBe(true);
  });

  it('keeps the file byte-for-byte when the dates are unchanged', () => {
    const spec = JSON.parse(season) as Record<string, unknown>;
    const ids = new Set(['rhino-patrol', 'rhino-patrol-junior', 'rhino-patrol-senior']);
    expect(withDates(spec, '2027-01-13', '2027-12-08', ids)).toEqual({
      text: season,
      problems: []
    });
  });

  it('refuses an end before the start, a bad date, and a missing course', () => {
    const spec = JSON.parse(season) as Record<string, unknown>;
    const ids = new Set(['rhino-patrol', 'rhino-patrol-junior', 'rhino-patrol-senior']);
    expect(withDates(spec, '2027-06-01', '2027-01-01', ids).problems.map((p) => p.path)).toEqual([
      '$.to'
    ]);
    expect(withDates(spec, '1 June', '2027-12-08', ids).problems.map((p) => p.path)).toEqual([
      '$.from'
    ]);
    expect(
      withDates(spec, '2027-01-13', '2027-12-08', new Set(['rhino-patrol'])).problems
    ).toHaveLength(2);
  });

  it('opens a pull request that changes only that one file, on a new branch from main', async () => {
    const fake = fakeGitHub(files, publicKey);
    const gh = new GitHub(config(), fake.fetchFn);
    const spec = JSON.parse(season) as Record<string, unknown>;
    const { text } = withDates(
      spec,
      '2026-12-01',
      '2027-12-08',
      new Set(['rhino-patrol', 'rhino-patrol-junior', 'rhino-patrol-senior'])
    );
    const url = await gh.proposeChange({
      branch: branchFor('rhino-patrol', new Date('2026-11-24T15:30:05Z')),
      path: 'content/seasons/rhino-patrol.json',
      text,
      sha: 'sha-content/seasons/rhino-patrol.json',
      message: 'Season 1 dates',
      title: 'Season 1 dates',
      body: 'From the back office'
    });
    expect(url).toBe('https://github.com/acme/robots/pull/7');
    const writes = fake.calls.filter((c) => c.method !== 'GET' && c.url.includes('/repos/'));
    expect(
      writes.map((c) => [c.method, c.url.replace('https://api.github.com/repos/acme/robots', '')])
    ).toEqual([
      ['POST', '/git/refs'],
      ['PUT', '/contents/content/seasons/rhino-patrol.json'],
      ['POST', '/pulls']
    ]);
    expect(writes[0]?.body).toEqual({
      ref: 'refs/heads/admin/season-rhino-patrol-20261124-153005',
      sha: 'main-sha'
    });
    const put = writes[1]?.body as { content: string; sha: string; branch: string };
    expect(Buffer.from(put.content, 'base64').toString('utf8')).toContain('"from": "2026-12-01"');
    expect(put.sha).toBe('sha-content/seasons/rhino-patrol.json');
    expect(put.branch).toBe('admin/season-rhino-patrol-20261124-153005');
    expect((writes[2]?.body as { base: string }).base).toBe('main');
    // Nothing ever writes to main directly.
    expect(
      fake.calls.some(
        (c) => c.method !== 'GET' && JSON.stringify(c.body).includes('"branch":"main"')
      )
    ).toBe(false);
  });

  it('reports GitHub failures instead of pretending it worked', async () => {
    const gh = new GitHub(config(), async () => new Response('{}', { status: 401 }));
    await expect(readSeasons(gh)).rejects.toBeInstanceOf(GitHubError);
  });
});
