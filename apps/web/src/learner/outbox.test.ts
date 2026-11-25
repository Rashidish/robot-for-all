import { describe, expect, it } from 'vitest';
import { type OutboxStore, recordId, type SheetRecord, sendOutbox } from './outbox';

const memory = (): OutboxStore & { rows: Map<string, SheetRecord> } => {
  const rows = new Map<string, SheetRecord>();
  return {
    rows,
    pending: async (l) => [...rows.values()].filter((r) => r.learner_id === l),
    add: async (r) => void rows.set(r.id, r),
    remove: async (id) => void rows.delete(id)
  };
};
const record = async (learner: string, at: string): Promise<SheetRecord> => {
  const base = {
    learner_id: learner,
    lesson_id: 'p1-crank-01',
    sheet_code: 'p1-crank-01-81feed',
    steps_done: 7,
    i_can: [true, false, true],
    built_working: true,
    team_sheet: false,
    recorded_at: at
  };
  return { ...base, id: await recordId(base) };
};

describe('the outbox (ADR-0014)', () => {
  it('makes the same id for the same record, a different one otherwise', async () => {
    const a = await record('l1', '2026-11-25T10:00:00Z');
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect((await record('l1', '2026-11-25T10:00:00Z')).id).toBe(a.id);
    expect((await record('l2', '2026-11-25T10:00:00Z')).id).not.toBe(a.id);
  });

  it('sends only this learner’s records, with their own session, and keeps the others', async () => {
    const store = memory();
    await store.add(await record('l1', '2026-11-25T10:00:00Z'));
    await store.add(await record('l2', '2026-11-25T10:01:00Z'));
    const seen: { auth: string | null; body: SheetRecord; prefer: string | null }[] = [];
    const ok = (async (_: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      seen.push({
        auth: h.get('authorization'),
        prefer: h.get('prefer'),
        body: JSON.parse(String(init?.body)) as SheetRecord
      });
      return new Response(null, { status: 201 });
    }) as typeof fetch;
    expect(await sendOutbox(store, 'l1', 'token-l1', ok)).toEqual({
      sent: 1,
      left: 0,
      signedOut: false
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.auth).toBe('Bearer token-l1');
    expect(seen[0]?.body.learner_id).toBe('l1');
    expect(seen[0]?.prefer).toContain('ignore-duplicates');
    expect([...store.rows.values()].map((r) => r.learner_id)).toEqual(['l2']);
  });

  it('going offline mid-send keeps what was not sent; a refused session stops', async () => {
    const store = memory();
    await store.add(await record('l1', '2026-11-25T10:00:00Z'));
    await store.add(await record('l1', '2026-11-25T10:05:00Z'));
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      if (calls === 1) return new Response(null, { status: 201 });
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(await sendOutbox(store, 'l1', 't', flaky)).toEqual({
      sent: 1,
      left: 1,
      signedOut: false
    });
    expect(store.rows.size).toBe(1);
    const refused = (async () => new Response(null, { status: 401 })) as typeof fetch;
    expect(await sendOutbox(store, 'l1', 't', refused)).toEqual({
      sent: 0,
      left: 1,
      signedOut: true
    });
    expect(store.rows.size).toBe(1);
    // A server error keeps it too.
    const broken = (async () => new Response(null, { status: 500 })) as typeof fetch;
    expect((await sendOutbox(store, 'l1', 't', broken)).left).toBe(1);
  });
});
