// Languages (more content spec §2.5): content/i18n/languages.json lists every language of the
// site with its status. English is the source and is always there. A language other than English
// is published only with a reviewer who reads it (reviewed_by), and has its own interface file
// content/i18n/<code>.json; missing words fall back to English (Paraglide), so a new language
// never breaks a page. One check for the public build and the back office.

export interface Language {
  code: string;
  /** Its name in English, e.g. "isiZulu". */
  name: string;
  /** Its name in itself, e.g. "isiZulu". */
  native: string;
  status: 'draft' | 'in_review' | 'published';
  /** True only for English, the source language. */
  source?: boolean;
  reviewed_by: string | null;
}

export interface LanguageList {
  languages: Language[];
}

/** South Africa's official written languages, offered by name when adding one. */
export const SA_LANGUAGES: { code: string; name: string; native: string }[] = [
  { code: 'zu', name: 'isiZulu', native: 'isiZulu' },
  { code: 'xh', name: 'isiXhosa', native: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'nso', name: 'Sepedi', native: 'Sepedi' },
  { code: 'tn', name: 'Setswana', native: 'Setswana' },
  { code: 'st', name: 'Sesotho', native: 'Sesotho' },
  { code: 'ts', name: 'Xitsonga', native: 'Xitsonga' },
  { code: 'ss', name: 'siSwati', native: 'siSwati' },
  { code: 've', name: 'Tshivenḓa', native: 'Tshivenḓa' },
  { code: 'nr', name: 'isiNdebele', native: 'isiNdebele' }
];

const CODE = /^[a-z]{2,3}$/;
const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Every problem with the language list. `files` are the interface files that exist (codes), and
 * `compiled` the locales the translation compiler is set up for (project.inlang/settings.json).
 */
export function checkLanguages(
  spec: unknown,
  files: ReadonlySet<string>,
  compiled: readonly string[]
): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  const err = (path: string, message: string) => out.push({ path, message });
  if (!isObject(spec) || !Array.isArray(spec['languages']))
    return [{ path: '$', message: 'must be { "languages": [...] }' }];
  const seen = new Set<string>();
  spec['languages'].forEach((l: unknown, i) => {
    const p = `$.languages[${i}]`;
    if (!isObject(l)) return err(p, 'must be an object');
    for (const k of Object.keys(l))
      if (!['code', 'name', 'native', 'status', 'source', 'reviewed_by'].includes(k))
        err(`${p}.${k}`, 'is not a field');
    const code = l['code'];
    if (typeof code !== 'string' || !CODE.test(code))
      return err(`${p}.code`, 'must be a language code like zu or nso');
    if (seen.has(code)) err(`${p}.code`, `${code} is listed twice`);
    seen.add(code);
    for (const k of ['name', 'native'] as const)
      if (typeof l[k] !== 'string' || (l[k] as string).trim().length < 2)
        err(`${p}.${k}`, 'must be a name');
    if (!['draft', 'in_review', 'published'].includes(l['status'] as string))
      err(`${p}.status`, 'must be draft, in_review or published');
    const rb = l['reviewed_by'];
    if (rb !== null && (typeof rb !== 'string' || rb.trim().length < 2))
      err(`${p}.reviewed_by`, 'must be a name or null');
    if (code === 'en') {
      if (l['source'] !== true || l['status'] !== 'published')
        err(p, 'English is the source language: source true, published');
    } else {
      if (l['source'] !== undefined) err(`${p}.source`, 'only English is the source');
      if (l['status'] === 'published' && rb === null)
        err(`${p}.reviewed_by`, 'a published language needs a reviewer who reads it');
      if (!files.has(code)) err(p, `content/i18n/${code}.json is missing`);
    }
  });
  if (!seen.has('en')) err('$.languages', 'English (the source) must be listed');
  const listed = [...seen].sort().join(',');
  if ([...compiled].sort().join(',') !== listed)
    err(
      '$.languages',
      `the languages here (${listed}) must match the locales in project.inlang/settings.json (${[...compiled].sort().join(',')})`
    );
  for (const f of files)
    if (!seen.has(f)) err('$.languages', `content/i18n/${f}.json has no entry here`);
  return out;
}

/** How much of the interface a language has: words translated (non-empty) out of English's. */
export function completeness(
  english: Record<string, string>,
  other: Record<string, string>
): { translated: number; total: number; missing: string[] } {
  const keys = Object.keys(english);
  const missing = keys.filter((k) => typeof other[k] !== 'string' || other[k].trim() === '');
  return { translated: keys.length - missing.length, total: keys.length, missing };
}
