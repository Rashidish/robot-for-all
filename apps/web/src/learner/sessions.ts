// Learner sessions on a shared phone (ADR-0013): each learner who signed in on this phone has
// their own 30-day session, kept in IndexedDB (not cookies, so learners never share one). Which
// learner is using the phone right now is kept only for this tab, and ends after 10 idle minutes.

export interface LearnerSession {
  learnerId: string;
  nickname: string;
  avatar: string;
  token: string;
  /** Seconds since 1970. */
  expiresAt: number;
}

export interface SessionStore {
  all(): Promise<LearnerSession[]>;
  put(s: LearnerSession): Promise<void>;
  remove(learnerId: string): Promise<void>;
}

/** The 9 pictures of the picture PIN, in pad order (ADR-0013). */
export const PIN_PICTURES = [
  { id: 'sun', emoji: '☀️' },
  { id: 'moon', emoji: '🌙' },
  { id: 'star', emoji: '⭐' },
  { id: 'tree', emoji: '🌳' },
  { id: 'fish', emoji: '🐟' },
  { id: 'cat', emoji: '🐱' },
  { id: 'ball', emoji: '⚽' },
  { id: 'car', emoji: '🚗' },
  { id: 'apple', emoji: '🍎' }
] as const;

export const IDLE_MINUTES = 10;

/** Sessions still valid now, most recently used first is the caller's choice; expired ones go. */
export async function liveSessions(store: SessionStore, nowSeconds: number) {
  const all = await store.all();
  const live = all.filter((s) => s.expiresAt > nowSeconds + 60);
  for (const s of all) if (!live.includes(s)) await store.remove(s.learnerId);
  return live.sort((a, b) => a.nickname.localeCompare(b.nickname));
}

/** A class code typed any way ("bcd fgh") as the six capitals the service expects. */
export const cleanCode = (input: string): string => input.replace(/[\s-]/g, '').toUpperCase();
export const validCode = (code: string): boolean => /^[BCDFGHJKLMNPQRSTVWXZ]{6}$/.test(code);

/** IndexedDB store "rfa-learners"; falls back to memory where IndexedDB is blocked. */
export function browserStore(): SessionStore {
  const memory = new Map<string, LearnerSession>();
  const open = (): Promise<IDBDatabase | null> =>
    new Promise((resolve) => {
      try {
        const req = indexedDB.open('rfa-learners', 1);
        req.onupgradeneeded = () =>
          req.result.createObjectStore('sessions', { keyPath: 'learnerId' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  const tx = async <T>(
    mode: IDBTransactionMode,
    work: (s: IDBObjectStore) => IDBRequest<T>
  ): Promise<T | null> => {
    const db = await open();
    if (!db) return null;
    return new Promise((resolve) => {
      const req = work(db.transaction('sessions', mode).objectStore('sessions'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  };
  return {
    async all() {
      const rows = await tx('readonly', (s) => s.getAll() as IDBRequest<LearnerSession[]>);
      return rows ?? [...memory.values()];
    },
    async put(s) {
      memory.set(s.learnerId, s);
      await tx('readwrite', (st) => st.put(s));
    },
    async remove(id) {
      memory.delete(id);
      await tx('readwrite', (st) => st.delete(id));
    }
  };
}

const CURRENT = 'rfa-learner-now';

/** The learner using the phone now (this tab only), or null after 10 idle minutes. */
export function currentLearner(storage: Pick<Storage, 'getItem' | 'removeItem'>, nowMs: number) {
  try {
    const raw = storage.getItem(CURRENT);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id: string; at: number };
    if (nowMs - v.at > IDLE_MINUTES * 60_000) {
      storage.removeItem(CURRENT);
      return null;
    }
    return v.id;
  } catch {
    return null;
  }
}

export function setCurrentLearner(storage: Pick<Storage, 'setItem'>, id: string, nowMs: number) {
  try {
    storage.setItem(CURRENT, JSON.stringify({ id, at: nowMs }));
  } catch {
    // Storage blocked: the learner picks themselves again on the next page.
  }
}

export function clearCurrentLearner(storage: Pick<Storage, 'removeItem'>) {
  try {
    storage.removeItem(CURRENT);
  } catch {
    // Nothing to clear.
  }
}
