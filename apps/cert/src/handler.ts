// The certificate service (ADR-0015, M5 spec §4.5, §6.2): the only code that holds the name key.
// Served on our own hostname at /cert/ (same origin as the site, so zero-rated and no CORS).
//   POST /cert/name        a parent adds or replaces their child's certificate name
//   POST /cert/show-names  a class's teacher or coach sees first name + initial for that class (FR-22a)
//   POST /cert/enrol       a class's teacher or coach enrols learners for parents to confirm
//                          (FR-5a): name and parent email locked, the parent emailed a link
//   POST /cert/pending     the parent opening that link sees which school and class it is
//   POST /cert/confirm     the parent confirms; the name moves to the child's profile
//   POST /cert/badges      a learner (their own session) asks for new badges to be awarded
//   POST /cert/certificate, /cert/certificates   certificate and badge-card PDFs (certificates.ts)
// Certificates and badge files (step 7) come later. Names are never logged, cached or echoed in
// errors; every answer is no-store.
import { cleanName, decryptName, encryptName, fromBytea, loadKeys, toBytea } from './crypto';
import { checkLearner } from './badges';
import { certificates } from './certificates';
import type { Fonts } from './pdf';
import { type MailEnv, type Mailer, mailerFrom, words } from './mail';

export interface Env extends MailEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  /** JSON {"<version>": "<base64 key>"}; a Cloudflare secret, never in the repository. */
  NAME_KEYS: string;
  /** The version new names are encrypted with. */
  NAME_KEY_CURRENT: string;
  /** The site's address, for links in emails (a var in wrangler.jsonc). */
  SITE_URL?: string;
  /** The back office's address, for the weekly privacy notice. */
  ADMIN_URL?: string;
  /** Where the weekly privacy notice goes (the Information Officer); a secret. */
  PRIVACY_NOTICE_EMAIL?: string;
}

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
  /** Defaults to the configured provider (none until the owner chooses one). */
  mailer?: Mailer | null;
  /** The certificate fonts (bundled by wrangler; read from disk in tests). */
  fonts?: () => Promise<Fonts>;
}

/** At most this many learners in one request (a class list). */
export const MAX_ENROL = 40;
const EMAIL = /^[^\s@<>"']{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const AVATAR = /^[a-z0-9-]{1,30}$/;
const LANGUAGE = /^[a-z]{2,3}$/;

/**
 * The teacher's console shows a learner as first name + surname initial ("Sipho M."), never
 * the full certificate name, which only appears on the certificate (FR-22a, owner 2026-11-27).
 */
export function shortName(full: string): string {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0] ?? '';
  if (words.length === 1) return first;
  const last = words[words.length - 1] ?? '';
  return `${first} ${last.charAt(0).toLocaleUpperCase()}.`;
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
  email: string;
  token: string;
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
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id) return null;
  // Supabase has just accepted the token, so its claims can be read. "amr" records when this
  // session signed in; refreshing the token keeps that time.
  const payload = JSON.parse(
    atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))
  ) as { amr?: { timestamp?: number }[] };
  const signedInAt = Math.max(0, ...(payload.amr ?? []).map((a) => a.timestamp ?? 0));
  return { id: user.id, email: (user.email ?? '').toLowerCase(), token, signedInAt };
}

/**
 * Calls a database function: service-only ones with the service key (migrations 0010, 0013,
 * 0014), or, given a person's token, as that person, so the database's own checks apply.
 */
export async function rpc<T>(
  env: Env,
  deps: Deps,
  fn: string,
  args: Record<string, unknown>,
  asUser?: string
) {
  const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: asUser ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_KEY,
      authorization: `Bearer ${asUser ?? env.SUPABASE_SERVICE_KEY}`,
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

const ROUTES = [
  '/cert/name',
  '/cert/show-names',
  '/cert/enrol',
  '/cert/pending',
  '/cert/confirm',
  '/cert/badges',
  '/cert/certificate',
  '/cert/certificates'
];

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
/** The hash the database keeps of a link's secret (the secret itself is never stored). */
export const tokenHash = async (token: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));

interface PendingRow {
  id: string;
  class_id: string;
  class_name: string;
  organisation_name: string;
  grade: number;
  certificate_name: string;
  certificate_name_key_version: number;
  parent_contact: string;
  parent_contact_key_version: number;
}

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method !== 'POST') return fail(405, 'POST only');
  if (!ROUTES.includes(pathname)) return fail(404, 'not found');
  const body = await readJson(request);
  if (!body) return fail(400, 'send JSON');
  if (pathname === '/cert/badges') {
    // A learner session (ADR-0013): the database says whose it is.
    const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(
      request.headers.get('authorization') ?? ''
    )?.[1];
    if (!token) return fail(401, 'Please sign in again.');
    const me = await rpc<string | null>(env, deps, 'whoami_learner', {}, token);
    if (!me.ok || !me.body) return fail(401, 'Please sign in again.');
    const mailer = deps.mailer === undefined ? mailerFrom(env) : deps.mailer;
    return reply(200, { awarded: await checkLearner(me.body, env, deps, mailer) });
  }
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

  if (pathname === '/cert/enrol') return enrol(url.origin, body, who, keys, env, deps);
  if (pathname === '/cert/certificate' || pathname === '/cert/certificates') {
    if (!deps.fonts) return fail(500, 'fonts');
    return certificates(pathname, body, who.id, env, deps, deps.fonts);
  }
  if (pathname === '/cert/pending' || pathname === '/cert/confirm') {
    const token = body['token'];
    if (typeof token !== 'string' || !TOKEN.test(token)) return fail(400, 'link');
    const hash = await tokenHash(token);
    const found = await rpc<PendingRow[]>(env, deps, 'pending_for_token', { p_hash: hash });
    if (!found.ok) return fail(found.status, found.message);
    const p = found.body[0];
    if (!p) return fail(404, 'expired');
    // Only the parent the school named: the email they signed in with must match.
    const contactKey = keys.get(p.parent_contact_key_version);
    let contact = '';
    try {
      if (contactKey) {
        contact = await decryptName(contactKey, `contact:${hash}`, fromBytea(p.parent_contact));
      }
    } catch {
      contact = '';
    }
    if (!contact || contact !== who.email) return fail(403, 'other email');
    if (pathname === '/cert/pending') {
      return reply(200, {
        class_name: p.class_name,
        organisation_name: p.organisation_name,
        grade: p.grade
      });
    }
    return confirm(token, hash, p, body, who, keys, env, deps);
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
        name: shortName(await decryptName(key, row.learner_id, fromBytea(row.certificate_name)))
      });
    } catch {
      // A name that does not decrypt is skipped, never guessed.
    }
  }
  return reply(200, { names });
}

/** A class's teacher or coach enrols learners for their parents to confirm (FR-5a). */
async function enrol(
  origin: string,
  body: Record<string, unknown>,
  who: Caller,
  keys: Map<number, CryptoKey>,
  env: Env,
  deps: Deps
): Promise<Response> {
  const cls = body['class'];
  const list = body['learners'];
  if (typeof cls !== 'string' || !UUID.test(cls)) return fail(400, 'which class?');
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_ENROL) {
    return fail(400, 'learners');
  }
  // Check every row before anything is stored; say which rows are wrong, never echo them.
  const rows: { name: string; grade: number; email: string }[] = [];
  const wrong: number[] = [];
  list.forEach((item: unknown, i) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const name = cleanName(r['name']);
    const grade = r['grade'];
    const email = typeof r['email'] === 'string' ? r['email'].trim().toLowerCase() : '';
    if (
      !name ||
      typeof grade !== 'number' ||
      !Number.isInteger(grade) ||
      grade < 1 ||
      grade > 12 ||
      !EMAIL.test(email)
    ) {
      wrong.push(i);
    } else {
      rows.push({ name, grade, email });
    }
  });
  if (wrong.length) return reply(422, { message: 'rows', rows: wrong });
  const mailer = deps.mailer === undefined ? mailerFrom(env) : deps.mailer;
  // Nothing is kept about a child whose parent we cannot tell.
  if (!mailer) return fail(503, 'email not set up');
  const version = Number(env.NAME_KEY_CURRENT);
  const key = keys.get(version);
  if (!key) return fail(500, 'the name key is not set up');
  const label = await rpc<{ class_name: string; organisation_name: string; language: string }[]>(
    env,
    deps,
    'class_label',
    { p_class: cls }
  );
  const where = label.ok ? label.body[0] : undefined;
  if (!where) return fail(404, 'class');

  let sent = 0;
  const failed: number[] = [];
  for (const [i, row] of rows.entries()) {
    const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
    const hash = await tokenHash(token);
    const made = await rpc<string>(env, deps, 'create_pending_enrolment', {
      p_class: cls,
      p_requested_by: who.id,
      p_grade: row.grade,
      p_name: toBytea(await encryptName(key, `pending:${hash}`, row.name)),
      p_name_key: version,
      p_contact: toBytea(await encryptName(key, `contact:${hash}`, row.email)),
      p_contact_key: version,
      p_token_hash: hash
    });
    // The link's secret, locked, so the daily job's reminders can carry the same link.
    if (made.ok) {
      await rpc(env, deps, 'store_pending_token', {
        p_id: made.body,
        p_sealed: toBytea(await encryptName(key, `token:${hash}`, token)),
        p_key: version
      });
    }
    if (!made.ok) {
      // Not this class's teacher, or the trial limit: stop and say so.
      if (sent === 0) return fail(made.status, made.message);
      failed.push(...rows.slice(i).map((_, j) => i + j));
      break;
    }
    const values = {
      organisation: where.organisation_name,
      class: where.class_name,
      link: `${origin}/enrol/confirm/#${token}`
    };
    const ok = await mailer
      .send(
        row.email,
        words(where.language, 'email_enrol_subject', values),
        words(where.language, 'email_enrol_body', values)
      )
      .catch(() => false);
    if (ok) sent += 1;
    else {
      await rpc(env, deps, 'drop_pending_enrolment', { p_id: made.body });
      failed.push(i);
    }
  }
  return reply(200, { sent, failed });
}

/** The parent confirms: the database makes or links the profile as them; the name is re-locked. */
async function confirm(
  token: string,
  hash: string,
  p: PendingRow,
  body: Record<string, unknown>,
  who: Caller,
  keys: Map<number, CryptoKey>,
  env: Env,
  deps: Deps
): Promise<Response> {
  const notice = body['notice'];
  const keepName = body['keep_name'] === true;
  const existing = body['existing'];
  const nickname = body['nickname'];
  const avatar = body['avatar'];
  const language = body['language'];
  if (typeof notice !== 'string' || !NOTICE.test(notice)) return fail(400, 'notice version?');
  if (
    existing !== undefined &&
    existing !== null &&
    (typeof existing !== 'string' || !UUID.test(existing))
  ) {
    return fail(400, 'which child?');
  }
  if (!existing) {
    if (typeof nickname !== 'string' || typeof avatar !== 'string' || !AVATAR.test(avatar)) {
      return fail(400, 'child');
    }
    if (typeof language !== 'string' || !LANGUAGE.test(language)) return fail(400, 'language');
  }
  // Unlock the school's copy of the name first: the database deletes it on confirming.
  let name = '';
  if (keepName) {
    const k = keys.get(p.certificate_name_key_version);
    try {
      if (k) name = await decryptName(k, `pending:${hash}`, fromBytea(p.certificate_name));
    } catch {
      name = '';
    }
  }
  const done = await rpc<string>(
    env,
    deps,
    'confirm_enrolment',
    {
      p_token: token,
      p_nickname: existing ? null : nickname,
      p_avatar: existing ? null : avatar,
      p_language: existing ? null : language,
      p_notice: notice,
      // The name is stored below, locked to the child's own profile.
      p_keep_name: false,
      p_existing: existing ?? null
    },
    who.token
  );
  if (!done.ok) return fail(done.status, done.message);
  const learner = done.body;
  if (name) {
    const version = Number(env.NAME_KEY_CURRENT);
    const key = keys.get(version);
    if (key) {
      await rpc(env, deps, 'set_certificate_name', {
        p_learner: learner,
        p_by: who.id,
        p_name: toBytea(await encryptName(key, learner, name)),
        p_key: version,
        p_notice: notice
      });
    }
  }
  return reply(200, { learner, name_kept: Boolean(name) });
}
