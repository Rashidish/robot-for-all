// A small client for accounts (M5): one-time sign-in codes, the session, and database calls,
// all through /db/ on our own domain (ADR-0017). A few lines instead of supabase-js (~50 KB).

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Seconds since 1970 when the access token expires. */
  expiresAt: number;
  userId: string;
}

export interface Deps {
  fetch: typeof fetch;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  now: () => number;
}

const KEY = 'rfa-session';
const BASE = '/db';

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function call<T>(deps: Deps, path: string, init: RequestInit, base = BASE): Promise<T> {
  const res = await deps.fetch(`${base}/${path}`, init);
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const b = (body ?? {}) as Record<string, unknown>;
    const message = String(b['message'] ?? b['msg'] ?? b['error_description'] ?? res.statusText);
    throw new AccountError(message, res.status);
  }
  return body as T;
}

const json = (body: unknown, token?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body)
});

interface TokenReply {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
}

export function accountClient(deps: Deps) {
  const save = (s: Session | null) => {
    try {
      if (s) deps.storage?.setItem(KEY, JSON.stringify(s));
      else deps.storage?.removeItem(KEY);
    } catch {
      // Storage blocked (private mode): the session lasts for this page only.
    }
    return s;
  };
  const fromReply = (r: TokenReply): Session => ({
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Math.floor(deps.now() / 1000) + r.expires_in,
    userId: r.user.id
  });
  let current: Session | null = (() => {
    try {
      const raw = deps.storage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  })();

  /** The session, refreshed when it has less than a minute left; null if signed out. */
  async function session(): Promise<Session | null> {
    if (!current) return null;
    if (current.expiresAt - 60 > deps.now() / 1000) return current;
    try {
      const r = await call<TokenReply>(
        deps,
        'auth/v1/token?grant_type=refresh_token',
        json({ refresh_token: current.refreshToken })
      );
      current = save(fromReply(r));
    } catch (err) {
      if (err instanceof AccountError && err.status < 500) current = save(null);
      else throw err;
    }
    return current;
  }

  async function token(): Promise<string> {
    const s = await session();
    if (!s) throw new AccountError('Please sign in again.', 401);
    return s.accessToken;
  }

  return {
    session,
    /** Sends a one-time code to this email (a new account is made the first time). */
    requestCode: (email: string) =>
      call<unknown>(deps, 'auth/v1/otp', json({ email: email.trim(), create_user: true })),
    /** Checks the code; signs in. */
    async verifyCode(email: string, code: string): Promise<Session> {
      const r = await call<TokenReply>(
        deps,
        'auth/v1/verify',
        json({ type: 'email', email: email.trim(), token: code.replace(/\s/g, '') })
      );
      const s = fromReply(r);
      current = save(s);
      return s;
    },
    async signOut(): Promise<void> {
      const s = current;
      current = save(null);
      if (s) await call(deps, 'auth/v1/logout', json({}, s.accessToken)).catch(() => undefined);
    },
    /** Calls a database function (migration 0010); its own checks decide. */
    async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      return call<T>(deps, `rest/v1/rpc/${fn}`, json(args, await token()));
    },
    /** Reads rows (row-level security decides which), e.g. select('classes', 'id,name'). */
    async select<T>(table: string, columns: string, filter = ''): Promise<T[]> {
      const q = `select=${encodeURIComponent(columns)}${filter ? `&${filter}` : ''}`;
      return call<T[]>(deps, `rest/v1/${table}?${q}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${await token()}`, accept: 'application/json' }
      });
    },
    /**
     * Calls the certificate service (/cert/, ADR-0015), the only place names are encrypted or
     * decrypted. What it returns is never stored by this client.
     */
    /** A certificate or badge-card PDF from the certificate service; never stored by this client. */
    async certPdf(
      path: 'certificate' | 'certificates',
      body: Record<string, unknown>
    ): Promise<Blob> {
      const res = await deps.fetch(`/cert/${path}`, json(body, await token()));
      if (!res.ok) {
        const text = await res.text();
        const b = (text ? JSON.parse(text) : {}) as { message?: string };
        throw new AccountError(b.message ?? res.statusText, res.status);
      }
      return res.blob();
    },
    async cert<T = unknown>(
      path: 'name' | 'show-names' | 'enrol' | 'pending' | 'confirm',
      body: Record<string, unknown>
    ): Promise<T> {
      return call<T>(deps, path, json(body, await token()), '/cert');
    }
  };
}

export type AccountClient = ReturnType<typeof accountClient>;

/** The client for this browser. */
export function browserClient(): AccountClient {
  const storage = ((): Deps['storage'] => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  return accountClient({ fetch: (...a) => fetch(...a), storage, now: () => Date.now() });
}
