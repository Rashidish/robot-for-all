// Where lesson translations live (more content spec §2.7). No imports, so any module can use it.

export const TRANSLATION_FILE =
  /^content\/lessons\/(p[1-3]-[a-z]+-\d{2})\/index\.([a-z]{2,3})\.md$/;

/** The lesson translations into one language on main, as "<lesson>/<language>" ids. */
export function translationIds(paths: readonly string[], lang: string): string[] {
  return paths
    .map((p) => TRANSLATION_FILE.exec(p))
    .filter((m): m is RegExpExecArray => m !== null && m[2] === lang)
    .map((m) => `${m[1]}/${lang}`)
    .sort();
}

/** A lesson's template source files on main (they count towards `translated_from`). */
export function templatePaths(paths: readonly string[], lesson: string): string[] {
  const prefix = `content/projects/${lesson}/templates/`;
  return paths.filter(
    (p) => p.startsWith(prefix) && p.endsWith('.ts') && !p.slice(prefix.length).includes('/')
  );
}
