// Personal data out before every call (CLAUDE.md §7, spec §7.1): emails, phone numbers, South
// African ID numbers, web addresses, a street address after "I live", a name after "my name is"
// and the like, and the nicknames of learners the asker can see. Errs on removing too much.

const EMAIL = /[^\s@<>()]{1,64}@[^\s@<>()]+\.[a-z]{2,}/gi;
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;
// 13-digit ID numbers, with or without spaces.
const ID_NUMBER = /\b\d{6}\s?\d{4}\s?\d{3}\b/g;
// Phone numbers: +27 or 0 followed by 9 digits, spaces or dashes allowed.
const PHONE = /(?:\+27|\b0)(?:[\s-]?\d){9}\b/g;
// "my name is Thandiwe", "I am called Sipho", "my child Lerato", "ngingu-Thandi" (isiZulu "I am"),
// "igama lami ngu-Thandi" ("my name is"): the capitalised words after are taken out.
// The lead-in words match in any case; the name after must start with a capital.
const anyCase = (w: string) =>
  w.replace(/\p{L}/gu, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`).replace(/ /g, '\\s+');
const LEADS = [
  'my name is',
  "my name's",
  'i am called',
  "i'm called",
  'called',
  'named',
  'learner',
  'child',
  'son',
  'daughter',
  'igama lami ngu',
  'ngingu'
];
const NAME_AFTER = new RegExp(
  `\\b(${LEADS.map(anyCase).join('|')})-?\\s*((?:\\p{Lu}[\\p{L}'-]+)(?:\\s+\\p{Lu}[\\p{L}'-]+){0,2})`,
  'gu'
);
const LIVE_AT =
  /\b(i live (?:at|in|on)|we live (?:at|in|on)|my address is|ngihlala e?)\s+[^.!?\n]{1,80}/gi;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function strip(question: string, nicknames: readonly string[] = []): string {
  let q = question.normalize('NFC');
  q = q.replace(EMAIL, '[email]');
  q = q.replace(URL_LIKE, '[link]');
  q = q.replace(ID_NUMBER, '[number]');
  q = q.replace(PHONE, '[number]');
  q = q.replace(LIVE_AT, (_m, lead: string) => `${lead} [place]`);
  q = q.replace(NAME_AFTER, (_m, lead: string) => `${lead} [name]`);
  // Nicknames, longest first, whole words, any case; each word of a two-word nickname too.
  const words = new Set<string>();
  for (const n of nicknames) {
    const name = n.trim();
    if (name.length < 2) continue;
    words.add(name);
    for (const part of name.split(/\s+/)) if (part.length >= 3) words.add(part);
  }
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    q = q.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escape(w)}(?![\\p{L}\\p{N}])`, 'giu'),
      'the learner'
    );
  }
  return q.replace(/\s+/g, ' ').trim();
}

/** A program as sent to the AI: its blocks only. Names and free text are dropped (spec FR-12). */
export function programForAi(program: unknown, maxChars = 6000): string | null {
  if (!program || typeof program !== 'object') return null;
  const keep = (value: unknown, key = ''): unknown => {
    if (Array.isArray(value)) return value.map((v) => keep(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (/^(name|title|author|comment|comments|note|notes|text|description)$/i.test(k)) continue;
        out[k] = keep(v, k);
      }
      return out;
    }
    // Strings that could be typed by a person (longer than a block field value) are dropped.
    if (typeof value === 'string' && value.length > 40 && key !== 'type') return '[text]';
    return value;
  };
  const json = JSON.stringify(keep(program));
  return json.length > maxChars ? json.slice(0, maxChars) : json;
}
