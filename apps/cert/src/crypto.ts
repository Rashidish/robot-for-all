// Certificate names (ADR-0015): AES-256-GCM in this Worker only. One key per version for all
// names; a random 96-bit nonce per value; the learner's id bound in as associated data, so a
// ciphertext copied onto another learner does not decrypt. Stored as nonce || ciphertext+tag.

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Keys by version, from the NAME_KEYS secret: {"1": "<base64 of 32 random bytes>"}. */
export async function loadKeys(secret: string): Promise<Map<number, CryptoKey>> {
  const raw = JSON.parse(secret) as Record<string, string>;
  const keys = new Map<number, CryptoKey>();
  for (const [version, b64] of Object.entries(raw)) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length !== 32) throw new Error(`name key ${version} is not 256 bits`);
    keys.set(
      Number(version),
      await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
    );
  }
  return keys;
}

export async function encryptName(
  key: CryptoKey,
  learner: string,
  name: string
): Promise<Uint8Array> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: enc.encode(learner) },
      key,
      enc.encode(name)
    )
  );
  const out = new Uint8Array(12 + sealed.length);
  out.set(nonce);
  out.set(sealed, 12);
  return out;
}

/** Throws if the key, the learner or the bytes are wrong. */
export async function decryptName(
  key: CryptoKey,
  learner: string,
  data: Uint8Array
): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12), additionalData: enc.encode(learner) },
    key,
    data.slice(12)
  );
  return dec.decode(plain);
}

/** A name as it will be printed: tidy spaces; 2–80 characters of letters, spaces, - ' and . */
export function cleanName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  return /^[\p{L}\p{M}][\p{L}\p{M} '’.-]{1,79}$/u.test(name) ? name : null;
}

// PostgREST sends and receives bytea as "\x" followed by hex.
export const toBytea = (b: Uint8Array): string =>
  `\\x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
export function fromBytea(s: string): Uint8Array {
  const hex = s.startsWith('\\x') ? s.slice(2) : s;
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error('not bytea');
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}
