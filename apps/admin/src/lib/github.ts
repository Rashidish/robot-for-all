// Content changes go to Git as pull requests through our GitHub App (ADR-0009). The App is
// installed on this one repository; branch protection on main means it can open pull requests
// but never change the live site by itself. Only server code uses this; the private key is a
// Worker secret.
import { importPKCS8, SignJWT } from 'jose';

export interface GitHubConfig {
  appId: string;
  /** The App's private key, PKCS#8 PEM ("-----BEGIN PRIVATE KEY-----"). */
  privateKey: string;
  installationId: string;
  /** owner/name */
  repo: string;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const API = 'https://api.github.com';

export interface Pull {
  number: number;
  html_url: string;
  title: string;
  state: string;
  user: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string };
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const utf8ToBase64 = (text: string): string => {
  let bin = '';
  for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin);
};
const base64ToUtf8 = (b64: string): string =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export class GitHub {
  private cached: { token: Promise<string>; until: number } | null = null;

  constructor(
    private readonly config: GitHubConfig,
    private readonly fetchFn: Fetch = (url, init) => fetch(url, init),
    private readonly now: () => number = () => Date.now()
  ) {}

  /** A short-lived installation token, cached until a minute before it expires. Calls made
      at the same time share one request. */
  private token(): Promise<string> {
    if (this.cached && this.cached.until > this.now()) return this.cached.token;
    const token = this.newToken();
    // Until GitHub says when it expires, assume the shortest life it gives (an hour).
    const entry = { token, until: this.now() + 59 * 60_000 };
    this.cached = entry;
    token.catch(() => {
      if (this.cached === entry) this.cached = null;
    });
    return token;
  }

  private async newToken(): Promise<string> {
    const key = await importPKCS8(this.config.privateKey, 'RS256');
    const seconds = Math.floor(this.now() / 1000);
    const appJwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(this.config.appId)
      .setIssuedAt(seconds - 60)
      .setExpirationTime(seconds + 540)
      .sign(key);
    const res = await this.fetchFn(
      `${API}/app/installations/${this.config.installationId}/access_tokens`,
      { method: 'POST', headers: this.headers(appJwt) }
    );
    if (!res.ok) throw new GitHubError('GitHub App sign-in failed', res.status);
    const body = (await res.json()) as { token: string; expires_at: string };
    if (this.cached) this.cached.until = Date.parse(body.expires_at) - 60_000;
    return body.token;
  }

  private headers(bearer: string): Record<string, string> {
    return {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'robots-for-all-admin'
    };
  }

  private async api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await this.fetchFn(`${API}/repos/${this.config.repo}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...this.headers(await this.token()), 'Content-Type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
    });
    if (!res.ok) throw new GitHubError(`GitHub ${init.method ?? 'GET'} ${path} failed`, res.status);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** The files in a folder on main. */
  async listDir(path: string): Promise<{ name: string; path: string }[]> {
    const items = await this.api<{ name: string; path: string; type: string }[]>(
      `/contents/${path}?ref=main`
    );
    return items.filter((i) => i.type === 'file').map(({ name, path: p }) => ({ name, path: p }));
  }

  /** The sub-folders of a folder on main (e.g. one per lesson). */
  async listDirs(path: string): Promise<string[]> {
    const items = await this.api<{ name: string; type: string }[]>(`/contents/${path}?ref=main`);
    return items.filter((i) => i.type === 'dir').map((i) => i.name);
  }

  /** A text file on main (or another ref), with its blob sha (needed to change it safely). */
  async readFile(path: string, ref = 'main'): Promise<{ text: string; sha: string }> {
    const file = await this.api<{ content: string; sha: string }>(
      `/contents/${path}?ref=${encodeURIComponent(ref)}`
    );
    return { text: base64ToUtf8(file.content), sha: file.sha };
  }

  /** Open pull requests from back-office branches (admin/…). */
  async openAdminPulls(): Promise<Pull[]> {
    const pulls = await this.api<Pull[]>('/pulls?state=open&base=main&per_page=100');
    return pulls.filter((p) => p.head.ref.startsWith('admin/'));
  }

  async getPull(n: number): Promise<Pull> {
    return this.api<Pull>(`/pulls/${n}`);
  }

  async pullFiles(n: number): Promise<{ filename: string; status: string }[]> {
    return this.api<{ filename: string; status: string }[]>(`/pulls/${n}/files?per_page=10`);
  }

  /** The CI result for a commit: all checks finished and none failed. */
  async checks(sha: string): Promise<'passed' | 'running' | 'failed'> {
    const { check_runs: runs } = await this.api<{
      check_runs: { status: string; conclusion: string | null }[];
    }>(`/commits/${sha}/check-runs?per_page=100`);
    if (runs.length === 0) return 'running';
    if (runs.some((r) => r.status !== 'completed')) return 'running';
    const good = new Set(['success', 'skipped', 'neutral']);
    return runs.every((r) => good.has(r.conclusion ?? '')) ? 'passed' : 'failed';
  }

  /** Squash-merges a pull request, only if its head is still this commit. */
  async merge(n: number, sha: string, title: string): Promise<void> {
    await this.api(`/pulls/${n}/merge`, {
      method: 'PUT',
      body: { sha, merge_method: 'squash', commit_title: title }
    });
  }

  /** Closes a pull request and deletes its branch (when a change is refused after opening). */
  async closePull(n: number, branch: string): Promise<void> {
    await this.api(`/pulls/${n}`, { method: 'PATCH', body: { state: 'closed' } });
    await this.api(`/git/refs/heads/${branch}`, { method: 'DELETE' }).catch(() => undefined);
  }

  /**
   * Puts one changed file on a new branch from main and opens a pull request. The file's
   * sha guards against overwriting a newer change made in the meantime.
   */
  async proposeChange(change: {
    branch: string;
    path: string;
    text: string;
    sha: string;
    message: string;
    title: string;
    body: string;
  }): Promise<string> {
    const main = await this.api<{ object: { sha: string } }>('/git/ref/heads/main');
    await this.api('/git/refs', {
      method: 'POST',
      body: { ref: `refs/heads/${change.branch}`, sha: main.object.sha }
    });
    await this.api(`/contents/${change.path}`, {
      method: 'PUT',
      body: {
        message: change.message,
        content: utf8ToBase64(change.text),
        sha: change.sha,
        branch: change.branch
      }
    });
    const pr = await this.api<{ html_url: string; number: number }>('/pulls', {
      method: 'POST',
      body: { title: change.title, head: change.branch, base: 'main', body: change.body }
    });
    this.lastPullNumber = pr.number;
    return pr.html_url;
  }

  /**
   * Several file changes (write or delete) on one new branch from main, then one pull request.
   * Each existing file's sha guards against overwriting a newer change.
   */
  async proposeChanges(change: {
    branch: string;
    files: { path: string; text?: string; sha?: string; remove?: boolean }[];
    message: string;
    title: string;
    body: string;
  }): Promise<string> {
    const main = await this.api<{ object: { sha: string } }>('/git/ref/heads/main');
    await this.api('/git/refs', {
      method: 'POST',
      body: { ref: `refs/heads/${change.branch}`, sha: main.object.sha }
    });
    for (const f of change.files) {
      await this.api(`/contents/${f.path}`, {
        method: f.remove ? 'DELETE' : 'PUT',
        body: f.remove
          ? { message: change.message, sha: f.sha, branch: change.branch }
          : {
              message: change.message,
              content: utf8ToBase64(f.text ?? ''),
              ...(f.sha ? { sha: f.sha } : {}),
              branch: change.branch
            }
      });
    }
    const pr = await this.api<{ html_url: string; number: number }>('/pulls', {
      method: 'POST',
      body: { title: change.title, head: change.branch, base: 'main', body: change.body }
    });
    this.lastPullNumber = pr.number;
    return pr.html_url;
  }

  /** The number of the pull request proposeChange last opened. */
  lastPullNumber = 0;
}
