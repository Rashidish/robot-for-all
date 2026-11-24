// Languages (more content spec §2.5): content/i18n/languages.json, checked when the site is built
// against the interface files present and the locales the translation compiler is set up for.
import inlang from '../../../../project.inlang/settings.json';
import list from '../../../../content/i18n/languages.json';
import { checkLanguages } from '../../../../packages/settings/src/languages';

const files = import.meta.glob('../../../../content/i18n/*.json');

/** Every problem with the language list, as "content/i18n/languages.json: <path>: <message>". */
export function languageProblems(): string[] {
  const codes = new Set(
    Object.keys(files)
      .map((p) => p.split('/').pop() ?? '')
      .filter((f) => /^[a-z]{2,3}\.json$/.test(f))
      .map((f) => f.replace('.json', ''))
  );
  return checkLanguages(list, codes, inlang.locales).map(
    (p) => `content/i18n/languages.json: ${p.path}: ${p.message}`
  );
}
