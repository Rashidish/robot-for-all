// Who asks the helper, and what the page says for each reply (M6 spec FR-1 to FR-3).
import { describe, expect, it } from 'vitest';
import type { LearnerSession, SessionStore } from '../learner/sessions';
import { findAsker, helperClient, statusKey } from './client';

const store = (sessions: LearnerSession[]): SessionStore => ({
  all: async () => sessions,
  put: async () => undefined,
  remove: async () => undefined
});
const kid: LearnerSession = {
  learnerId: 'k1',
  nickname: 'Thandi R',
  avatar: 'rocket',
  token: 'kid.token.sig',
  expiresAt: 2000
};

describe('findAsker', () => {
  it('the child using the phone now comes first, then the signed-in adult, else nobody', async () => {
    const adult = async () => ({ accessToken: 'adult.token.sig' });
    expect(
      await findAsker({
        session: adult,
        learners: store([kid]),
        current: () => 'k1',
        nowSeconds: () => 1000
      })
    ).toEqual({ kind: 'child', token: 'kid.token.sig' });
    // An expired learner session, or no child now: the adult.
    expect(
      await findAsker({
        session: adult,
        learners: store([kid]),
        current: () => 'k1',
        nowSeconds: () => 1990
      })
    ).toEqual({ kind: 'adult', token: 'adult.token.sig' });
    expect(
      await findAsker({
        session: adult,
        learners: store([kid]),
        current: () => null,
        nowSeconds: () => 1000
      })
    ).toEqual({ kind: 'adult', token: 'adult.token.sig' });
    expect(
      await findAsker({
        session: async () => null,
        learners: store([]),
        current: () => null,
        nowSeconds: () => 1000
      })
    ).toBeNull();
  });
});

describe('helperClient', () => {
  it('asks with the asker’s token and says "offline" when the network fails', async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const ok = helperClient((async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') });
      return Response.json({ status: 'ok', answer: 'Turn it slowly.' });
    }) as typeof fetch);
    expect(await ok.ask('t.o.k', { question: 'Why?', page: 'home', language: 'en' })).toEqual({
      status: 'ok',
      answer: 'Turn it slowly.'
    });
    expect(seen).toEqual([{ url: '/helper/ask', auth: 'Bearer t.o.k' }]);
    const down = helperClient((async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch);
    expect(await down.ask('t', { question: 'Why?', page: 'home', language: 'en' })).toEqual({
      status: 'offline'
    });
    expect(await down.faq('p1-crank-01', 'en')).toEqual([]);
  });

  it('every status has a message key; unknown ones read as "unavailable"', () => {
    expect(statusKey('daily_cap')).toBe('helper_status_daily_cap');
    expect(statusKey('something new')).toBe('helper_status_unavailable');
  });
});
