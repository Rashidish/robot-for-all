// Cloudflare Worker entry for the certificate service (route robotsforall.org.za/cert/*), and
// its daily job (Cron Trigger in wrangler.jsonc).
import bold from '../fonts/NotoSans-Bold.ttf';
import regular from '../fonts/NotoSans-Regular.ttf';
import { runDaily } from './daily';
import { type Env, handle } from './handler';

const fonts = () =>
  Promise.resolve({ regular: new Uint8Array(regular), bold: new Uint8Array(bold) });

export default {
  fetch: (request: Request, env: Env) => handle(request, env, { fetch, now: Date.now, fonts }),
  scheduled: (_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) => {
    ctx.waitUntil(runDaily(env, { fetch, now: Date.now }));
  }
};
