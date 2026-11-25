// Site settings (docs/specs/back-office.md §6.7): content/site/settings.json, changed from the
// back office through a pull request and built into the static site. One check for both: the
// public build fails on a bad file, and the back office refuses to send one.

/** Parts of the public site that can be switched off. Off hides the part; nothing is deleted. */
export const FEATURES = [
  'robot_world',
  'print_course',
  'seasons',
  'send_to_microbit',
  // M5: sign-in, classes and progress (off until the owner opens them; the drafts preview shows them).
  'accounts'
] as const;
export type Feature = (typeof FEATURES)[number];

/** Languages the banner may be written in; English is required (CLAUDE.md §2.4). */
export const BANNER_LANGUAGES = ['en'] as const;
export const BANNER_MAX = 160;

export interface Announcement {
  /** First and last day it shows, YYYY-MM-DD, South African dates. */
  from: string;
  to: string;
  /** The words, per language; pages in other languages fall back to English. */
  text: Record<string, string>;
  /** Optional page on this site, e.g. "/code/". */
  link?: string;
}

export interface SiteSettings {
  announcement: Announcement | null;
  features: Record<Feature, boolean>;
}

export interface SettingsProblem {
  path: string;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: unknown): s is string =>
  typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every problem with a settings file. */
export function checkSettings(spec: unknown): SettingsProblem[] {
  const out: SettingsProblem[] = [];
  const err = (path: string, message: string) => out.push({ path, message });
  if (!isObject(spec)) return [{ path: '$', message: 'must be an object' }];
  for (const k of Object.keys(spec))
    if (k !== 'announcement' && k !== 'features') err(`$.${k}`, 'is not a site setting');

  const a = spec['announcement'];
  if (a !== null) {
    if (!isObject(a)) {
      err('$.announcement', 'must be null (no banner) or a banner');
    } else {
      for (const k of Object.keys(a))
        if (!['from', 'to', 'text', 'link'].includes(k))
          err(`$.announcement.${k}`, 'is not a banner field');
      if (!isDate(a['from'])) err('$.announcement.from', 'must be a date like 2027-01-06');
      if (!isDate(a['to'])) err('$.announcement.to', 'must be a date like 2027-01-13');
      if (isDate(a['from']) && isDate(a['to']) && a['to'] < a['from'])
        err('$.announcement.to', 'must not be before the start');
      const text = a['text'];
      if (!isObject(text)) {
        err('$.announcement.text', 'must give the words per language, e.g. { "en": "…" }');
      } else {
        if (typeof text['en'] !== 'string' || text['en'].trim() === '')
          err('$.announcement.text.en', 'English is required');
        for (const [lang, words] of Object.entries(text)) {
          if (!(BANNER_LANGUAGES as readonly string[]).includes(lang))
            err(
              `$.announcement.text.${lang}`,
              `is not a site language (${BANNER_LANGUAGES.join(', ')})`
            );
          else if (typeof words !== 'string') err(`$.announcement.text.${lang}`, 'must be text');
          else if (words.length > BANNER_MAX)
            err(`$.announcement.text.${lang}`, `must be at most ${BANNER_MAX} characters`);
          else if (/[<>]/.test(words))
            err(`$.announcement.text.${lang}`, 'must not contain < or >');
        }
      }
      const link = a['link'];
      if (
        link !== undefined &&
        (typeof link !== 'string' || !/^\/(?!\/)[a-z0-9\-/#?=&.]*$/i.test(link))
      )
        err('$.announcement.link', 'must be a page on this site, starting with / (e.g. /code/)');
    }
  }

  const f = spec['features'];
  if (!isObject(f)) {
    err('$.features', `must switch each part on or off: ${FEATURES.join(', ')}`);
  } else {
    for (const k of Object.keys(f))
      if (!(FEATURES as readonly string[]).includes(k)) err(`$.features.${k}`, 'is not a switch');
    for (const k of FEATURES)
      if (typeof f[k] !== 'boolean') err(`$.features.${k}`, 'must be true (on) or false (off)');
  }
  return out;
}

/** A checked settings file (throws with every problem on a bad one). */
export function buildSettings(spec: unknown): SiteSettings {
  const problems = checkSettings(spec);
  if (problems.length > 0)
    throw new Error(
      problems.map((p) => `content/site/settings.json ${p.path}: ${p.message}`).join('\n')
    );
  return spec as SiteSettings;
}

/** The banner's words for a page language (falls back to English). */
export const bannerText = (a: Announcement, lang: string): string =>
  a.text[lang] ?? a.text['en'] ?? '';

/** A short id for "the learner closed this banner": a new banner shows again. */
export function bannerId(a: Announcement): string {
  let h = 5381;
  for (const c of JSON.stringify(a)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
