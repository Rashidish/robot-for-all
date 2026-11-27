// The allowed list (ADR-0018, spec FR-25, FR-26). A model may be chosen in the back office only if
// it is here, with its provider checklist filled in (providers/README.md). Prices are list prices
// in US dollars per million tokens, used to estimate spend against the monthly budget.

export interface AllowedModel {
  provider: 'anthropic';
  /** Input, cache read, cache write and output prices, USD per million tokens. */
  usdPerMillion: { input: number; cacheRead: number; cacheWrite: number; output: number };
  /** Checklist: the provider does not keep or train on inputs, so children may use it. */
  forChildren: boolean;
}

export const ALLOWED: Record<string, AllowedModel> = {
  // Claude API (checklist: providers/README.md). Cache prices estimated at 0.1x and 1.25x input.
  'claude-haiku-5-5': {
    provider: 'anthropic',
    usdPerMillion: { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
    forChildren: true
  },
  'claude-sonnet-5-5': {
    provider: 'anthropic',
    usdPerMillion: { input: 2, cacheRead: 0.1, cacheWrite: 2.5, output: 10 },
    forChildren: true
  },
  'claude-opus-5-5': {
    provider: 'anthropic',
    usdPerMillion: { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 },
    forChildren: true
  }
};

/** The model to use for an audience: the setting if allowed (and safe for children), else Haiku. */
export function modelFor(setting: string, audience: 'adult' | 'child' | 'faq'): string {
  const m = ALLOWED[setting];
  if (!m) return 'claude-haiku-5-5';
  if ((audience === 'child' || audience === 'faq') && !m.forChildren) return 'claude-haiku-5-5';
  return setting;
}

/** Estimated cost in South African cents, rounded up, from tokens and the dollar rate. */
export function costCents(
  model: string,
  usage: { input: number; cacheRead: number; cacheWrite: number; output: number },
  zarPerUsd: number
): number {
  const p = ALLOWED[model]?.usdPerMillion;
  if (!p) return 0;
  const usd =
    (usage.input * p.input +
      usage.cacheRead * p.cacheRead +
      usage.cacheWrite * p.cacheWrite +
      usage.output * p.output) /
    1_000_000;
  return Math.ceil(usd * zarPerUsd * 100);
}
