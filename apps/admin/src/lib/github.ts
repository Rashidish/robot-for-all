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
    return (await res.json()) as T;
  }

  /** The files in a folder on main. */
  async listDir(path: string): Promise<{ name: string; path: string }[]> {
    const items = await this.api<{ name: string; path: string; type: string }[]>(
      `/contents/${path}?ref=main`
    );
    return items.filter((i) => i.type === 'file').map(({ name, path: p }) => ({ name, path: p }));
  }

  /** A text file on main, with its blob sha (needed to change it safely). */
  async readFile(path: string): Promise<{ text: string; sha: string }> {
    const file = await this.api<{ content: string; sha: string }>(`/contents/${path}?ref=main`);
    return { text: base64ToUtf8(file.content), sha: file.sha };
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
    const pr = await this.api<{ html_url: string }>('/pulls', {
      method: 'POST',
      body: { title: change.title, head: change.branch, base: 'main', body: change.body }
    });
    return pr.html_url;
  }
}
