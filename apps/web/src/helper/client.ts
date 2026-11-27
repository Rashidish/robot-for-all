// Talks to the AI helper on /helper/ (M6 spec, ADR-0018). Who is asking: the child using this phone
// now, if one signed in within 10 minutes (their own learner session, ADR-0013), else the signed-in
// adult (M5 account), else nobody (Common questions only). Nothing typed is kept on the phone.
import { browserClient } from '../account/client';
import { browserStore, currentLearner, type SessionStore } from '../learner/sessions';

export type Asker = { kind: 'adult' | 'child'; token: string } | null;

export interface AskerDeps {
  session: () => Promise<{ accessToken: string } | null>;
  learners: SessionStore;
  current: () => string | null;
  nowSeconds: () => number;
}

export async function findAsker(deps: AskerDeps): Promise<Asker> {
  const id = deps.current();
  if (id) {
    const s = (await deps.learners.all()).find(
      (x) => x.learnerId === id && x.expiresAt > deps.nowSeconds() + 60
    );
    if (s) return { kind: 'child', token: s.token };
  }
  const adult = await deps.session().catch(() => null);
  return adult ? { kind: 'adult', token: adult.accessToken } : null;
}

export function browserAsker(): Promise<Asker> {
  const client = browserClient();
  return findAsker({
    session: () => client.session(),
    learners: browserStore(),
    current: () => {
      try {
        return currentLearner(sessionStorage, Date.now());
      } catch {
        return null;
      }
    },
    nowSeconds: () => Date.now() / 1000
  });
}

export interface FaqItem {
  item: number;
  q: string;
  a: string;
}

export interface AskBody {
  question: string;
  page: 'home' | 'lesson';
  lesson?: string;
  language: string;
  earlier?: { question: string; answer: string };
}

export interface AskReply {
  status: string;
  answer?: string;
}

const post = (fetchFn: typeof fetch, path: string, token: string, body: unknown) =>
  fetchFn(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });

export function helperClient(fetchFn: typeof fetch = (...a) => fetch(...a)) {
  return {
    /** A lesson's Common questions; an empty list when offline with no saved copy. */
    async faq(lesson: string, language: string): Promise<FaqItem[]> {
      try {
        const res = await fetchFn(`/helper/faq/${lesson}?lang=${language}`);
        if (!res.ok) return [];
        return ((await res.json()) as { items?: FaqItem[] }).items ?? [];
      } catch {
        return [];
      }
    },
    async ask(token: string, body: AskBody): Promise<AskReply> {
      try {
        const res = await post(fetchFn, '/helper/ask', token, body);
        const reply = (await res.json().catch(() => ({}))) as Partial<AskReply>;
        return {
          status: typeof reply.status === 'string' ? reply.status : 'unavailable',
          ...(reply.answer ? { answer: reply.answer } : {})
        };
      } catch {
        return { status: 'offline' };
      }
    },
    async thumb(token: string, up: boolean): Promise<void> {
      await post(fetchFn, '/helper/thumb', token, { up }).catch(() => undefined);
    },
    async faqDown(token: string, lesson: string, language: string, item: number): Promise<boolean> {
      try {
        const res = await post(fetchFn, '/helper/faq-down', token, { lesson, language, item });
        return ((await res.json()) as { hidden?: boolean }).hidden === true;
      } catch {
        return false;
      }
    }
  };
}

/** Every reply status the page explains, each with a message key (helper_status_<status>). */
export const STATUSES = [
  'off',
  'children_off',
  'no_consent',
  'lesson_only',
  'class_off',
  'class_cap',
  'daily_cap',
  'paused',
  'month_cap',
  'budget',
  'refused',
  'blocked',
  'safety',
  'unavailable',
  'no_account',
  'sign_in',
  'slow_down',
  'bad_request',
  'offline'
] as const;

export const statusKey = (status: string): string =>
  `helper_status_${(STATUSES as readonly string[]).includes(status) ? status : 'unavailable'}`;
