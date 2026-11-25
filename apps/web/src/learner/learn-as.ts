// "Learn as <child>" on a parent's own phone, and a personal learner's own session (family spec
// FF-4, FP-4): the sign-in service starts the learner's session from the adult's own session, if
// the database says they're the learner's parent or guardian. Then /me/ as for any learner.
import type { AccountClient } from '../account/client';
import { browserStore, setCurrentLearner } from './sessions';

export async function learnAs(client: AccountClient, learnerId: string): Promise<boolean> {
  const s = await client.session();
  if (!s) return false;
  const res = await fetch('/signin/as', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${s.accessToken}` },
    body: JSON.stringify({ learner: learnerId })
  });
  if (!res.ok) return false;
  const b = (await res.json()) as {
    token: string;
    expires_at: number;
    learner: { id: string; nickname: string; avatar: string };
  };
  await browserStore().put({
    learnerId: b.learner.id,
    nickname: b.learner.nickname,
    avatar: b.learner.avatar,
    token: b.token,
    expiresAt: b.expires_at
  });
  setCurrentLearner(sessionStorage, b.learner.id, Date.now());
  location.href = '/me/';
  return true;
}
