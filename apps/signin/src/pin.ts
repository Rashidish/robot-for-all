// Picture PINs (ADR-0013): 4 taps from 9 pictures (6,561 combinations). The PIN space is small,
// so the real defence is the lock after 5 wrong tries (database) and the rate limits (Worker);
// the hash only keeps PINs unreadable in the database. PBKDF2-SHA256, a random salt per PIN.

export const PIN_LENGTH = 4;
export const PICTURES = 9;
const ITERATIONS = 100_000;
const enc = new TextEncoder();

/** A PIN is exactly 4 picture numbers, each 0–8. */
export function validPin(pin: unknown): pin is number[] {
  return (
    Array.isArray(pin) &&
    pin.length === PIN_LENGTH &&
    pin.every((p) => Number.isInteger(p) && p >= 0 && p < PICTURES)
  );
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(
  pin: number[],
  learner: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${learner}:${pin.join('')}`),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  );
}

/** "pbkdf2$<iterations>$<salt>$<hash>", bound to the learner. */
export async function hashPin(pin: number[], learner: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(pin, learner, salt, ITERATIONS))}`;
}

export async function checkPin(pin: number[], learner: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = stored.split('$');
  if (kind !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const got = await derive(pin, learner, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= (got[i] ?? 0) ^ (want[i] ?? 0);
  return diff === 0;
}
