// Answer-sheet records saved on the phone and sent when there is a connection (ADR-0014, answer
// sheets Part B). One outbox per learner, sent only with that learner's own session, so a record
// never lands under someone else even when several learners share a phone. Each record has an id
// made on the phone, so sending it twice is harmless (the database ignores the repeat).

export interface SheetRecord {
  id: string;
  learner_id: string;
  lesson_id: string;
  sheet_code: string;
  steps_done: number;
  i_can: boolean[];
  built_working: boolean;
  team_sheet: boolean;
  recorded_at: string;
}

export interface OutboxStore {
  pending(learnerId: string): Promise<SheetRecord[]>;
  add(r: SheetRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The record's id: SHA-256 of learner, lesson, sheet code and time (ADR-0014). */
export async function recordId(r: Omit<SheetRecord, 'id'>): Promise<string> {
  const text = [r.learner_id, r.lesson_id, r.sheet_code, r.recorded_at].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type SendResult = { sent: number; left: number; signedOut: boolean };

/**
 * Sends one learner's waiting records with their own session. Stops at the first failure and
 * keeps everything not yet accepted; a refused session (401/403) means the learner must sign in
 * again before anything more is sent.
 */
export async function sendOutbox(
  store: OutboxStore,
  learnerId: string,
  token: string,
  doFetch: typeof fetch
): Promise<SendResult> {
  const waiting = await store.pending(learnerId);
  let sent = 0;
  for (const r of waiting) {
    if (r.learner_id !== learnerId) continue;
    let res: Response;
    try {
      res = await doFetch('/db/rest/v1/sheet_records', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          prefer: 'resolution=ignore-duplicates,return=minimal'
        },
        body: JSON.stringify(r)
      });
    } catch {
      break; // offline or cut off: try again later
    }
    if (res.status === 401 || res.status === 403) {
      return { sent, left: waiting.length - sent, signedOut: true };
    }
    if (!res.ok) break;
    await store.remove(r.id);
    sent += 1;
  }
  return { sent, left: waiting.length - sent, signedOut: false };
}

/** IndexedDB store "rfa-outbox" (records keyed by id, found by learner). */
export function browserOutbox(): OutboxStore {
  const memory = new Map<string, SheetRecord>();
  const open = (): Promise<IDBDatabase | null> =>
    new Promise((resolve) => {
      try {
        const req = indexedDB.open('rfa-outbox', 1);
        req.onupgradeneeded = () =>
          req.result
            .createObjectStore('records', { keyPath: 'id' })
            .createIndex('learner', 'learner_id');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  const run = async <T>(
    mode: IDBTransactionMode,
    work: (s: IDBObjectStore) => IDBRequest<T>
  ): Promise<T | null> => {
    const db = await open();
    if (!db) return null;
    return new Promise((resolve) => {
      const req = work(db.transaction('records', mode).objectStore('records'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  };
  // Ask the browser not to clear saved records under storage pressure (ADR-0014).
  void navigator.storage?.persist?.().catch(() => false);
  return {
    async pending(learnerId) {
      const rows = await run(
        'readonly',
        (s) => s.index('learner').getAll(learnerId) as IDBRequest<SheetRecord[]>
      );
      return (rows ?? [...memory.values()].filter((r) => r.learner_id === learnerId)).sort((a, b) =>
        a.recorded_at.localeCompare(b.recorded_at)
      );
    },
    async add(r) {
      memory.set(r.id, r);
      await run('readwrite', (s) => s.put(r));
    },
    async remove(id) {
      memory.delete(id);
      await run('readwrite', (s) => s.delete(id));
    }
  };
}
