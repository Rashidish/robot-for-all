// Cloudflare Worker entry for the AI helper (route robotsforall.org.za/helper/*), and its daily job.
import { type DailyEnv, runDaily } from './daily.ts';
import { handle } from './handler.ts';

export default {
  fetch: (request: Request, env: DailyEnv) => handle(request, env, { fetch, now: Date.now }),
  scheduled: (_event: unknown, env: DailyEnv, ctx: { waitUntil(p: Promise<unknown>): void }) => {
    ctx.waitUntil(runDaily(env, { fetch, now: Date.now }));
  }
};
