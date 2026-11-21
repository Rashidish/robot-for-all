// Interface text (ADR-0003). Messages live in content/i18n/<locale>.json and are compiled by
// Paraglide JS into apps/web/src/paraglide (generated, not committed) by `npm run i18n`.
// Each message is a typed function: m.nav_home(). A missing or misspelt key fails type-checking.
export { m } from '../paraglide/messages.js';
export { baseLocale as lang, locales } from '../paraglide/runtime.js';
