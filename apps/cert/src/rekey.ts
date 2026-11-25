// Name key rotation (ADR-0015, migration 0027), run by the daily job. When the owner adds a new
// key version to NAME_KEYS and sets NAME_KEY_CURRENT to it, every locked value still on an older
// version (certificate names, parents' emails and link secrets of waiting school enrolments) is
// opened in memory with its old key and locked again with the current one, in batches. Only
// counts are returned or logged. The old key may be removed once name_key_counts() shows 0 for it.
import { decryptName, encryptName, fromBytea, toBytea } from './crypto';
import { type Deps, type Env, rpc } from './handler';

interface RekeyRow {
  kind: 'learner' | 'pending';
  id: string;
  token_hash: string | null;
  name: string | null;
  name_key: number | null;
  contact: string | null;
  contact_key: number | null;
  token: string | null;
  token_key: number | null;
}

export interface RekeyReport {
  /** Values locked again with the current key. */
  rekeyed: number;
  /** Values that could not be opened (their key version is missing from NAME_KEYS). */
  unreadable: number;
}

/** Rows per database call; at most BATCHES calls a day keeps the Worker within its limits. */
export const BATCH = 500;
export const BATCHES = 10;

export async function rekeyNames(
  env: Env,
  deps: Deps,
  keys: Map<number, CryptoKey>
): Promise<RekeyReport> {
  const report: RekeyReport = { rekeyed: 0, unreadable: 0 };
  const current = Number(env.NAME_KEY_CURRENT);
  const key = keys.get(current);
  if (!key) return report;
  // Values that can't be opened are skipped; remember them so a batch isn't read again forever.
  const skip = new Set<string>();

  for (let i = 0; i < BATCHES; i++) {
    const res = await rpc<RekeyRow[]>(env, deps, 'names_to_rekey', {
      p_current: current,
      p_limit: BATCH + skip.size
    });
    if (!res.ok) break;
    const rows = (res.body ?? []).filter((r) => !skip.has(`${r.kind}:${r.id}`));
    if (rows.length === 0) break;

    const updates: Record<string, unknown>[] = [];
    for (const r of rows) {
      const update: Record<string, unknown> = { kind: r.kind, id: r.id };
      // Each value is bound to its owner: the learner id, or the waiting enrolment's link hash.
      const fields: [string, string | null, number | null, string][] =
        r.kind === 'learner'
          ? [['name', r.name, r.name_key, r.id]]
          : [
              ['name', r.name, r.name_key, `pending:${r.token_hash}`],
              ['contact', r.contact, r.contact_key, `contact:${r.token_hash}`],
              ['token', r.token, r.token_key, `token:${r.token_hash}`]
            ];
      let opened = true;
      for (const [field, sealed, version, bound] of fields) {
        if (sealed === null || version === null || version === current) continue;
        const old = keys.get(version);
        const plain = old
          ? await decryptName(old, bound, fromBytea(sealed)).catch(() => null)
          : null;
        if (plain === null) {
          opened = false;
          continue;
        }
        update[field] = toBytea(await encryptName(key, bound, plain));
        update[`${field}_key`] = current;
        update[`old_${field}_key`] = version;
      }
      if (!opened) {
        report.unreadable += 1;
        skip.add(`${r.kind}:${r.id}`);
      }
      if (Object.keys(update).length > 2) updates.push(update);
    }
    if (updates.length > 0) {
      const saved = await rpc<number>(env, deps, 'rekey_names', { p_rows: updates });
      if (!saved.ok) break;
      report.rekeyed += Number(saved.body);
    }
    if (rows.length < BATCH) break;
  }
  return report;
}
