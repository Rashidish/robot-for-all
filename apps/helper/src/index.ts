// Cloudflare Worker entry for the AI helper (route robotsforall.org.za/helper/*).
import { type Env, handle } from './handler.ts';

export default {
  fetch: (request: Request, env: Env) => handle(request, env, { fetch, now: Date.now })
};
