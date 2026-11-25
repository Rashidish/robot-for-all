// Cloudflare Worker entry for the certificate service (route robotsforall.org.za/cert/*), and
// its daily job (Cron Trigger in wrangler.jsonc).
import { runDaily } from './daily';
import { type Env, handle } from './handler';

export default {
  fetch: (request: Request, env: Env) => handle(request, env, { fetch, now: Date.now }),
  scheduled: (_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) => {
    ctx.waitUntil(runDaily(env, { fetch, now: Date.now }));
  }
};
