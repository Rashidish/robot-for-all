// Lesson translations (more content spec §2.7): content/lessons/<id>/index.<lang>.md holds only
// the translated words; every fact (grades, cost, quantities, templates, programs) comes from the
// English lesson. `translated_from` records which English text was translated, so a change to the
// English lesson marks the translation "needs updating" until it is checked again.

/** Front matter lines that change when a lesson is reviewed, not when its words change. */
const REVIEW_LINES = /^(status|reviewed_by|build_tested_by|ai_generated):.*$/gm;

/** The English lesson text a translation depends on: everything except the review lines. */
export function translationSource(englishFile: string): string {
  return englishFile.replace(/\r\n/g, '\n').replace(REVIEW_LINES, '');
}

/**
 * The `translated_from` value for an English lesson: 16 hex characters of the SHA-256 of its file
 * (without the review lines) and its template sheets' source files
 * (content/projects/<lesson>/templates/*.ts), so changing a sheet also stales its translations
 * (translate-templates spec §2.4).
 */
export async function translationHash(
  englishFile: string,
  templateFiles: readonly { name: string; text: string }[] = []
): Promise<string> {
  const sheets = [...templateFiles]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((t) => `\n--- template ${t.name}\n${t.text.replace(/\r\n/g, '\n')}`)
    .join('');
  const bytes = new TextEncoder().encode(translationSource(englishFile) + sheets);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The `##` headings of a lesson body, in order. */
export const headings = (body: string): string[] =>
  [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((h) => (h[1] ?? '').trim());

/** The words a translation carries, as checked against its English lesson. */
export interface TranslatedWords {
  title: string;
  outcomes: string[];
  concepts: string[];
  parts: { item: string; substitute?: string | undefined }[];
  safety_notes: string[];
  assessment: string[];
}

export interface EnglishWords {
  outcomes: string[];
  concepts: string[];
  parts: { item: string; substitute?: string | undefined }[];
  safety: { notes: string[] };
  assessment: string[];
}

/**
 * Problems that would make a translation disagree with its English lesson: every list has the
 * same number of items in the same order, a part has a substitute exactly when the English one
 * does, and the body has the same `##` sections (so each one maps to its PRIMM step).
 */
export function translationProblems(
  english: EnglishWords,
  englishBody: string,
  words: TranslatedWords,
  body: string
): string[] {
  const problems: string[] = [];
  const same = (name: string, a: unknown[], b: unknown[]) => {
    if (a.length !== b.length)
      problems.push(`${name}: the English lesson has ${a.length}, this has ${b.length}`);
  };
  same('outcomes', english.outcomes, words.outcomes);
  same('concepts', english.concepts, words.concepts);
  same('parts', english.parts, words.parts);
  same('safety_notes', english.safety.notes, words.safety_notes);
  same('assessment', english.assessment, words.assessment);
  english.parts.forEach((p, i) => {
    const t = words.parts[i];
    if (t && Boolean(p.substitute) !== Boolean(t.substitute))
      problems.push(
        `parts ${i + 1}: ${p.substitute ? 'needs' : 'must not have'} a substitute, as in English`
      );
  });
  const en = headings(englishBody);
  const here = headings(body);
  if (en.length !== here.length)
    problems.push(
      `the English lesson has ${en.length} "##" sections (${en.join(', ')}), this has ${here.length}`
    );
  return problems;
}

/**
 * What a page in another language shows for a lesson with this translation: the translation
 * (`live`), the translation with a notice (`draft` or `stale`, drafts preview only), or the
 * English lesson. Production shows only a published, up-to-date translation.
 */
export function translationView(
  status: 'draft' | 'in_review' | 'published',
  stale: boolean,
  showDrafts: boolean
): 'live' | 'draft' | 'stale' | 'english' {
  if (status === 'published' && !stale) return 'live';
  if (!showDrafts) return 'english';
  return stale ? 'stale' : 'draft';
}
