// Every request: Cloudflare Access check, sign-in and MFA state, roles, then the guard decides
// (src/lib/guard.ts). Security headers on every response. See ADR-0009, ADR-0010, ADR-0011.
import { defineMiddleware } from 'astro:middleware';
import { ACCESS_AUD, ACCESS_TEAM } from 'astro:env/server';
import { ACCESS_HEADER, verifyAccess } from './lib/access';
import { decide, SECURITY_HEADERS } from './lib/guard';
import { isRole, type Role } from './lib/roles';
import { serverClient } from './lib/supabase';

function secured(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    // The local dev server injects inline scripts and styles for hot reload; production has none.
    if (import.meta.env.DEV && k === 'Content-Security-Policy') continue;
    out.headers.set(k, v);
  }
  return out;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  // Local development has no Cloudflare Access in front; production always checks it.
  const access = import.meta.env.DEV
    ? ({ ok: true, email: '' } as const)
    : await verifyAccess(ctx.request.headers.get(ACCESS_HEADER), {
        team: ACCESS_TEAM ?? '',
        aud: ACCESS_AUD ?? ''
      });
  if (!access.ok) {
    // The reason names what failed (not configured, no token, wrong app...), never a secret or an email,
    // so the owner can see it with `wrangler tail`.
    console.warn(`Access refused: ${access.reason}`);
    return secured(new Response('Not allowed.', { status: 403 }));
  }

  const supabase = serverClient(ctx.request, ctx.cookies);
  ctx.locals.supabase = supabase;
  ctx.locals.user = null;
  ctx.locals.roles = [];

  // getUser() asks Supabase to check the session, rather than trusting the cookie.
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  let mfa = false;
  if (user?.email) {
    // The person Cloudflare Access let in must be the person signed in.
    if (access.email && access.email.toLowerCase() !== user.email.toLowerCase()) {
      await supabase.auth.signOut();
      return secured(
        new Response('Signed-in account does not match Cloudflare Access.', { status: 403 })
      );
    }
    ctx.locals.user = { id: user.id, email: user.email };
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfa = aal.data?.currentLevel === 'aal2';
    if (mfa) {
      const { data: rows } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id);
      ctx.locals.roles = (rows ?? [])
        .map((r: { role: unknown }) => r.role)
        .filter(isRole) as Role[];
    }
  }

  const decision = decide(ctx.url.pathname, {
    access: true,
    signedIn: ctx.locals.user !== null,
    mfa,
    hasRole: ctx.locals.roles.length > 0
  });
  if (decision.kind === 'forbidden') return secured(new Response('Not allowed.', { status: 403 }));
  if (decision.kind === 'redirect') return secured(ctx.redirect(decision.to, 303));
  return secured(await next());
});
