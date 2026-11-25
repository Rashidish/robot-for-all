// The certificate service (ADR-0015, M5 spec §4.5, §6.2): the only code that holds the name key.
// Served on our own hostname at /cert/ (same origin as the site, so zero-rated and no CORS).
//   POST /cert/name        a parent adds or replaces their child's certificate name
//   POST /cert/show-names  a class's teacher or coach sees the names for that class (FR-22a)
// Certificates and badge files (step 7) come later. Names are never logged, cached or echoed in
// errors; every answer is no-store.
import { cleanName, decryptName, encryptName, fromBytea, loadKeys, toBytea } from './crypto';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  /** JSON {"<version>": "<base64 key>"}; a Cloudflare secret, never in the repository. */
  NAME_KEYS: string;
  /** The version new names are encrypted with. */
  NAME_KEY_CURRENT: string;
}

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

/** Show names needs a sign-in within this many seconds (FR-22a). */
export const RECENT_SIGN_IN = 12 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOTICE = /^[0-9]+(\.[0-9]+)*$/;

const reply = (status: number, body: unknown = null): Response =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
const fail = (status: number, message: string) => reply(status, { message });

interface Caller {
  id: string;
  signedInAt: number;
}

/** The signed-in adult, checked by Supabase itself; null if the token is missing or bad. */
async function caller(request: Request, env: Env, deps: Deps): Promise<Caller | null> {
  const auth = request.headers.get('authorization') ?? '';
  const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(auth)?.[1];
  if (!token) return null;
  const res = await deps.fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user.id) return null;
  // Supabase has just accepted the token, so its claims can be read. "amr" records when this
  // session signed in; refreshing the token keeps that time.
  const payload = JSON.parse(
    atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))
  ) as { amr?: { timestamp?: number }[] };
  const signedInAt = Math.max(0, ...(payload.amr ?? []).map((a) => a.timestamp ?? 0));
  return { id: user.id, signedInAt };
}

/** Calls a service-only database function (migrations 0010, 0013). */
async function rpc<T>(env: Env, deps: Deps, fn: string, args: Record<string, unknown>) {
  const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // Database messages are written for people and never contain a name.
    const message = String((body as { message?: unknown } | null)?.message ?? 'database error');
    return { ok: false as const, status: res.status === 403 ? 403 : 400, message };
  }
  return { ok: true as const, body: body as T };
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return null;
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method !== 'POST') return fail(405, 'POST only');
  if (pathname !== '/cert/name' && pathname !== '/cert/show-names') return fail(404, 'not found');
  const body = await readJson(request);
  if (!body) return fail(400, 'send JSON');
  const who = await caller(request, env, deps);
  if (!who) return fail(401, 'Please sign in again.');
  const keys = await loadKeys(env.NAME_KEYS);

  if (pathname === '/cert/name') {
    const learner = body['learner'];
    const notice = body['notice'];
    const name = cleanName(body['name']);
    if (typeof learner !== 'string' || !UUID.test(learner)) return fail(400, 'which child?');
    if (typeof notice !== 'string' || !NOTICE.test(notice)) return fail(400, 'notice version?');
    if (!name) return fail(422, 'name');
    const version = Number(env.NAME_KEY_CURRENT);
    const key = keys.get(version);
    if (!key) return fail(500, 'the name key is not set up');
    const sealed = await encryptName(key, learner, name);
    const r = await rpc(env, deps, 'set_certificate_name', {
      p_learner: learner,
      p_by: who.id,
      p_name: toBytea(sealed),
      p_key: version,
      p_notice: notice
    });
    return r.ok ? reply(204) : fail(r.status, r.message);
  }

  // /cert/show-names
  const cls = body['class'];
  if (typeof cls !== 'string' || !UUID.test(cls)) return fail(400, 'which class?');
  if (deps.now() / 1000 - who.signedInAt > RECENT_SIGN_IN) {
    return fail(401, 'recent sign-in needed');
  }
  const r = await rpc<{ learner_id: string; certificate_name: string; key_version: number }[]>(
    env,
    deps,
    'reveal_class_names',
    { p_class: cls, p_by: who.id }
  );
  if (!r.ok) return fail(r.status, r.message);
  const names: { learner: string; name: string }[] = [];
  for (const row of r.body) {
    const key = keys.get(row.key_version);
    if (!key) continue;
    try {
      names.push({
        learner: row.learner_id,
        name: await decryptName(key, row.learner_id, fromBytea(row.certificate_name))
      });
    } catch {
      // A name that does not decrypt is skipped, never guessed.
    }
  }
  return reply(200, { names });
}
