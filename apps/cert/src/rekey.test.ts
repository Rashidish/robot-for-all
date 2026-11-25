// Name key rotation (ADR-0015, migration 0027): the daily job locks every value again with the
// current key, in batches; values it can't open are counted and left; the database sees only
// locked bytes.
import { beforeEach, describe, expect, it } from 'vitest';
import { decryptName, encryptName, fromBytea, loadKeys, toBytea } from './crypto';
import type { Env } from './handler';
import { BATCH, rekeyNames } from './rekey';

const K1 = Buffer.alloc(32, 1).toString('base64');
const K2 = Buffer.alloc(32, 2).toString('base64');
const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: K1, 2: K2 }),
  NAME_KEY_CURRENT: '2'
};
const HASH = 'c'.repeat(64);

interface Value {
  bytes: string;
  key: number;
}
interface Learner {
  id: string;
  name: Value;
}
interface Pending {
  id: string;
  hash: string;
  name: Value;
  contact: Value;
  token: Value;
}
let learners: Learner[];
let pending: Pending[];
let sent: string[];
let keys: Map<number, CryptoKey>;

const lock = async (version: number, bound: string, plain: string): Promise<Value> => {
  const key = keys.get(version);
  if (!key) throw new Error('no key');
  return { bytes: toBytea(await encryptName(key, bound, plain)), key: version };
};
const open = async (v: Value, bound: string) => {
  const key = keys.get(v.key);
  if (!key) throw new Error('no key');
  return decryptName(key, bound, fromBytea(v.bytes));
};

// The database, as migration 0027 behaves: lists values on another version, saves only while
// the version is still the old one.
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const fn = /\/rpc\/(\w+)$/.exec(String(input))?.[1] ?? '';
  const body = String(init?.body ?? '{}');
  sent.push(body);
  const args = JSON.parse(body) as Record<string, unknown>;
  if (fn === 'names_to_rekey') {
    const cur = Number(args['p_current']);
    const limit = Number(args['p_limit']);
    return Response.json([
      ...learners
        .filter((l) => l.name.key !== cur)
        .slice(0, limit)
        .map((l) => ({
          kind: 'learner',
          id: l.id,
          token_hash: null,
          name: l.name.bytes,
          name_key: l.name.key,
          contact: null,
          contact_key: null,
          token: null,
          token_key: null
        })),
      ...pending
        .filter((p) => [p.name, p.contact, p.token].some((v) => v.key !== cur))
        .slice(0, limit)
        .map((p) => ({
          kind: 'pending',
          id: p.id,
          token_hash: p.hash,
          name: p.name.bytes,
          name_key: p.name.key,
          contact: p.contact.bytes,
          contact_key: p.contact.key,
          token: p.token.bytes,
          token_key: p.token.key
        }))
    ]);
  }
  if (fn === 'rekey_names') {
    let n = 0;
    for (const r of args['p_rows'] as Record<string, unknown>[]) {
      const row = (
        r['kind'] === 'learner'
          ? learners.find((l) => l.id === r['id'])
          : pending.find((p) => p.id === r['id'])
      ) as Partial<Record<string, Value>> | undefined;
      for (const field of ['name', 'contact', 'token']) {
        const v = row?.[field];
        if (r[field] === undefined || !v || v.key !== r[`old_${field}_key`]) continue;
        v.bytes = String(r[field]);
        v.key = Number(r[`${field}_key`]);
        n += 1;
      }
    }
    return Response.json(n);
  }
  return Response.json(null);
}) as typeof fetch;
const deps = { fetch: fakeFetch, now: Date.now };

beforeEach(async () => {
  keys = await loadKeys(env.NAME_KEYS);
  sent = [];
  learners = [];
  for (let i = 0; i < 3; i++) {
    const id = `l${i}`;
    learners.push({ id, name: await lock(1, id, `Thandiwe Radebe ${i}`) });
  }
  pending = [
    {
      id: 'p1',
      hash: HASH,
      name: await lock(1, `pending:${HASH}`, 'Sipho Mthembu'),
      contact: await lock(1, `contact:${HASH}`, 'mom@example.org'),
      token: await lock(1, `token:${HASH}`, 'e'.repeat(64))
    }
  ];
});

describe('name key rotation', () => {
  it('locks every value again with the current key; the same words come out', async () => {
    expect(await rekeyNames(env, deps, keys)).toEqual({ rekeyed: 6, unreadable: 0 });
    for (const [i, l] of learners.entries()) {
      expect(l.name.key).toBe(2);
      expect(await open(l.name, l.id)).toBe(`Thandiwe Radebe ${i}`);
    }
    const [p] = pending;
    if (!p) throw new Error('no pending');
    expect(await open(p.name, `pending:${HASH}`)).toBe('Sipho Mthembu');
    expect(await open(p.contact, `contact:${HASH}`)).toBe('mom@example.org');
    expect(await open(p.token, `token:${HASH}`)).toBe('e'.repeat(64));
    // With key 1 gone, every value still opens: certificates still print.
    const onlyNew = await loadKeys(JSON.stringify({ 2: K2 }));
    const k2 = onlyNew.get(2);
    if (!k2) throw new Error('no key');
    expect(await decryptName(k2, 'l0', fromBytea(learners[0]?.name.bytes ?? ''))).toBe(
      'Thandiwe Radebe 0'
    );
    // A second run has nothing to do.
    expect(await rekeyNames(env, deps, keys)).toEqual({ rekeyed: 0, unreadable: 0 });
    // The database never saw a word in the open.
    expect(sent.join()).not.toMatch(/Thandiwe|Sipho|mom@|eeeeeeee/);
  });

  it('works through more than one batch', async () => {
    for (let i = 3; i < BATCH + 20; i++) {
      learners.push({ id: `l${i}`, name: await lock(1, `l${i}`, `Learner ${i}`) });
    }
    const r = await rekeyNames(env, deps, keys);
    expect(r.rekeyed).toBe(BATCH + 20 + 3);
    expect(learners.every((l) => l.name.key === 2)).toBe(true);
  });

  it('counts values whose key is missing, leaves them, and does not loop on them', async () => {
    const lost = await lock(1, 'l0', 'Thandiwe Radebe 0');
    const fewer = await loadKeys(JSON.stringify({ 2: K2 }));
    learners = [{ id: 'l0', name: lost }];
    pending = [];
    expect(await rekeyNames(env, deps, fewer)).toEqual({ rekeyed: 0, unreadable: 1 });
    expect(learners[0]?.name.key).toBe(1);
    expect(sent.filter((b) => b.includes('p_current')).length).toBeLessThanOrEqual(2);
  });

  it('does nothing when the current key is missing from NAME_KEYS', async () => {
    const r = await rekeyNames({ ...env, NAME_KEY_CURRENT: '3' }, deps, keys);
    expect(r).toEqual({ rekeyed: 0, unreadable: 0 });
    expect(sent).toEqual([]);
  });
});
