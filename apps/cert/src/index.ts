// Cloudflare Worker entry for the certificate service (route robotsforall.org.za/cert/*).
import { type Env, handle } from './handler';

export default {
  fetch: (request: Request, env: Env) => handle(request, env, { fetch, now: Date.now })
};
