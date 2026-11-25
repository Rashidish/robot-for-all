// Lives at the repository root: "wrangler pages deploy" (run from the root) picks up ./functions.
// Cloudflare Pages Function: /db/* → Supabase, for allowed requests only (ADR-0017).
// Secrets (Cloudflare Pages settings): SUPABASE_URL, SUPABASE_ANON_KEY. Without them the
// function answers 503, so the site works unchanged until accounts are set up.
import { allowedPath, FORWARDED_HEADERS } from '../../apps/web/src/account/proxy';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

interface Context {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
}

export async function onRequest({ request, env, params }: Context): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return new Response('Accounts are not set up yet.', { status: 503 });
  }
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  const target = allowedPath(request.method, path);
  if (!target) return new Response('Not allowed.', { status: 404 });
  const url = new URL(request.url);
  const headers = new Headers();
  for (const h of FORWARDED_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('apikey', env.SUPABASE_ANON_KEY);
  if (!headers.has('authorization'))
    headers.set('authorization', `Bearer ${env.SUPABASE_ANON_KEY}`);
  const upstream = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/${target}${url.search}`, {
    method: request.method,
    headers,
    body: request.method === 'GET' ? null : await request.text()
  });
  const out = new Headers();
  for (const h of ['content-type', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // Account data is never stored by the browser, the service worker or any cache.
  out.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
