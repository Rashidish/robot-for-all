// Interface text (ADR-0003). Messages live in content/i18n/<locale>.json and are compiled by
// Paraglide JS into apps/web/src/paraglide (generated, not committed) by `npm run i18n`.
// Each message is a typed function: m.nav_home(). A missing or misspelt key fails type-checking.
import { baseLocale, getLocale } from '../paraglide/runtime.js';

export { m } from '../paraglide/messages.js';
export { baseLocale, locales } from '../paraglide/runtime.js';

/** The language of the page being built (set per page by src/middleware.ts). */
export const pageLang = (): string => getLocale();

/**
 * A link to a page on this site in the page's language: /lessons/ stays /lessons/ in English
 * and becomes /zu/lessons/ in isiZulu. Files (icons, SVG templates) need no prefix.
 */
export function localHref(path: string, lang: string = getLocale()): string {
  if (lang === baseLocale || !path.startsWith('/') || path.startsWith('//')) return path;
  return `/${lang}${path}`;
}
