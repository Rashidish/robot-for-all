// The languages this build serves, with their own names, for the language switch (more content
// spec §2.5). Same rule as astro.config.ts: English always; others when published and not
// withdrawn on production, or all in the drafts preview.
import list from '../../../content/i18n/languages.json';
import {
  type Language,
  type LanguageList,
  liveLanguages
} from '../../../packages/settings/src/languages';
import { isOff } from './withdrawn';

export const siteLanguages: Language[] = liveLanguages(
  list as LanguageList,
  (code) => isOff('language', code),
  __RFA_SHOW_DRAFTS__
);

/** A page path without its language prefix: /zu/lessons/ → /lessons/. */
export function basePath(path: string): string {
  const m = /^\/([a-z]{2,3})(\/.*)?$/.exec(path);
  if (m && siteLanguages.some((l) => l.code === m[1] && l.code !== 'en')) return m[2] ?? '/';
  return path;
}
