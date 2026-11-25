import { describe, expect, it } from 'vitest';
import { cleanName, decryptName, encryptName, fromBytea, loadKeys, toBytea } from './crypto';

async function keyOf(keys: Map<number, CryptoKey>, v: number): Promise<CryptoKey> {
  const k = keys.get(v);
  if (!k) throw new Error('no key');
  return k;
}

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const keyB64 = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');

describe('certificate name encryption (ADR-0015)', () => {
  it('round-trips, and never repeats a ciphertext', async () => {
    const key = await keyOf(await loadKeys(JSON.stringify({ 1: keyB64() })), 1);
    const one = await encryptName(key, A, 'Thandiwe Radebe');
    const two = await encryptName(key, A, 'Thandiwe Radebe');
    expect(toBytea(one)).not.toBe(toBytea(two));
    expect(new TextDecoder().decode(one)).not.toContain('Thandiwe');
    expect(await decryptName(key, A, fromBytea(toBytea(one)))).toBe('Thandiwe Radebe');
  });

  it('fails for another learner, another key or changed bytes', async () => {
    const keys = await loadKeys(JSON.stringify({ 1: keyB64(), 2: keyB64() }));
    const sealed = await encryptName(await keyOf(keys, 1), A, 'Sipho Mokoena');
    await expect(decryptName(await keyOf(keys, 1), B, sealed)).rejects.toThrow();
    await expect(decryptName(await keyOf(keys, 2), A, sealed)).rejects.toThrow();
    const changed = sealed.slice();
    changed[20] = (changed[20] ?? 0) ^ 1;
    await expect(decryptName(await keyOf(keys, 1), A, changed)).rejects.toThrow();
  });

  it('refuses keys that are not 256 bits', async () => {
    await expect(loadKeys(JSON.stringify({ 1: 'c2hvcnQ=' }))).rejects.toThrow(/256/);
  });

  it('tidies names and refuses anything that is not a name', () => {
    expect(cleanName('  Thandiwe   Radebe ')).toBe('Thandiwe Radebe');
    expect(cleanName("Nomsa O'Brien-Dlamini")).toBe("Nomsa O'Brien-Dlamini");
    expect(cleanName('Zoë Ndlovu')).toBe('Zoë Ndlovu');
    for (const bad of ['', 'A', '<script>', 'Name 123', 'x'.repeat(81), 42, null]) {
      expect(cleanName(bad)).toBeNull();
    }
  });
});
