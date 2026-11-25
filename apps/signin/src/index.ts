// Cloudflare Worker entry for the learner sign-in service (route robotsforall.org.za/signin/*).
import { type Env, handle } from './handler';

export default {
  fetch: (request: Request, env: Env) => handle(request, env, { fetch, now: Date.now })
};
