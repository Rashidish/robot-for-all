// The learner sign-in service (ADR-0013 and its amendment; M5 spec §6.4). Served on our own
// hostname at /signin/. The only holder of Supabase's JWT secret.
//   POST /signin/roster  {class_code}            the class's nicknames and pictures
//   POST /signin/pin     {class_code, learner, pin, choose?}
//        checks the picture PIN (or sets a first one) and returns a 30-day learner session
// Limits: 5 wrong PINs lock the learner for 5 minutes (database); per address and per class
// rate limits here. Answers are no-store and carry no more than the sign-in screen shows.
import { learnerToken } from './jwt';
import { checkPin, hashPin, validPin } from './pin';

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  /** Supabase's JWT secret (Settings → API → JWT secret); a Cloudflare secret. */
  SUPABASE_JWT_SECRET: string;
  /** Workers rate limiting bindings (wrangler.jsonc); absent in tests and local runs. */
  BY_ADDRESS?: RateLimiter;
  BY_CLASS?: RateLimiter;
}

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

const CODE = /^[BCDFGHJKLMNPQRSTVWXZbcdfghjklmnpqrstvwxz]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  if (!res.ok) return null;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface SignInRow {
  learner_id: string;
  nickname: string;
  avatar: string;
  pin_hash: string | null;
  locked_until: string | null;
  session_version: number;
}

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method !== 'POST') return reply(405, { message: 'POST only' });
  if (pathname !== '/signin/roster' && pathname !== '/signin/pin') {
    return reply(404, { message: 'not found' });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { message: 'send JSON' });
  }
  const code = typeof body['class_code'] === 'string' ? body['class_code'].replace(/\s/g, '') : '';
  if (!CODE.test(code)) return reply(400, { message: 'class code' });
  const address = request.headers.get('cf-connecting-ip') ?? 'unknown';
  for (const [limiter, key] of [
    [env.BY_ADDRESS, `a:${address}`],
    [env.BY_CLASS, `c:${code.toUpperCase()}`]
  ] as const) {
    if (limiter && !(await limiter.limit({ key })).success) {
      return reply(429, { message: 'too many tries' });
    }
  }

  if (pathname === '/signin/roster') {
    const rows = await rpc<{ learner_id: string; nickname: string; avatar: string }[]>(
      env,
      deps,
      'sign_in_roster',
      { p_class_code: code }
    );
    if (rows === null) return reply(502, { message: 'try again' });
    return reply(200, { learners: rows });
  }

  // /signin/pin
  const learner = body['learner'];
  const pin = body['pin'];
  if (typeof learner !== 'string' || !UUID.test(learner) || !validPin(pin)) {
    return reply(400, { message: 'learner and pin' });
  }
  const rows = await rpc<SignInRow[]>(env, deps, 'learner_for_sign_in', {
    p_class_code: code,
    p_learner: learner
  });
  const row = rows?.[0];
  if (!row) return reply(404, { message: 'not in this class' });
  if (row.locked_until && Date.parse(row.locked_until) > deps.now()) {
    return reply(423, { message: 'locked', until: row.locked_until });
  }
  if (row.pin_hash === null) {
    // First sign-in, or after a reset: the learner chooses their pictures.
    if (body['choose'] !== true) return reply(409, { message: 'choose a pin' });
    const chosen = await rpc<boolean>(env, deps, 'choose_learner_pin', {
      p_learner: learner,
      p_hash: await hashPin(pin, learner)
    });
    if (!chosen) return reply(409, { message: 'already chosen' });
  } else {
    const ok = await checkPin(pin, learner, row.pin_hash);
    const allowed = await rpc<boolean>(env, deps, 'record_pin_attempt', {
      p_learner: learner,
      p_ok: ok
    });
    if (allowed === false) return reply(423, { message: 'locked' });
    if (!ok) return reply(401, { message: 'wrong pin' });
  }
  const session = await learnerToken(
    env.SUPABASE_JWT_SECRET,
    learner,
    row.session_version,
    Math.floor(deps.now() / 1000)
  );
  return reply(200, {
    token: session.token,
    expires_at: session.expiresAt,
    learner: { id: row.learner_id, nickname: row.nickname, avatar: row.avatar }
  });
}
