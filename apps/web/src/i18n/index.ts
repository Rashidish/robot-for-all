// Interface text lookup. English only at launch (ADR-0003).
// Temporary: step 4 replaces the inside of this module with Paraglide JS; pages keep calling t().
// Keys are typed from en.json, so a missing or misspelt key fails `npm run typecheck`.
import en from '../../../../content/i18n/en.json';

export type MessageKey = keyof typeof en;

export const lang = 'en';

export function t(key: MessageKey): string {
  return en[key];
}
