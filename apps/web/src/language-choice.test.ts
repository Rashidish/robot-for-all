import { describe, expect, it } from 'vitest';
import { LANGUAGE_KEY, rememberLanguage } from './language-choice';

function page(lang: string, available = ['en', 'zu']) {
  const clicks: Record<string, () => void> = {};
  const links = available.map((code) => ({
    getAttribute: (n: string) =>
      n === 'data-lang'
        ? code
        : n === 'href'
          ? code === 'en'
            ? '/lessons/'
            : `/${code}/lessons/`
          : null,
    addEventListener: (_t: string, fn: () => void) => void (clicks[code] = fn)
  }));
  const doc = {
    documentElement: { lang },
    querySelector: () => ({ getAttribute: () => available.join(' ') }),
    querySelectorAll: () => links
  };
  const went: string[] = [];
  return { doc, location: { replace: (u: string) => void went.push(u) }, clicks, went };
}
const store = (v: string | null = null) => {
  const m = new Map<string, string>(v ? [[LANGUAGE_KEY, v]] : []);
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, x: string) => void m.set(k, x)
  };
};

describe('remembering the language on this device', () => {
  it('opens the stored language when the page is in another one', () => {
    const p = page('en');
    rememberLanguage(p.doc, p.location, store('zu'));
    expect(p.went).toEqual(['/zu/lessons/']);
  });

  it('stays put when there is no choice, the same language, or a language no longer served', () => {
    for (const [lang, stored, available] of [
      ['en', null, ['en', 'zu']],
      ['zu', 'zu', ['en', 'zu']],
      ['en', 'xh', ['en', 'zu']]
    ] as const) {
      const p = page(lang, [...available]);
      rememberLanguage(p.doc, p.location, store(stored));
      expect(p.went).toEqual([]);
    }
  });

  it('tapping a language stores it; blocked storage is fine', () => {
    const s = store();
    const p = page('en');
    rememberLanguage(p.doc, p.location, s);
    p.clicks['zu']?.();
    expect(s.getItem(LANGUAGE_KEY)).toBe('zu');
    const q = page('en');
    expect(() => rememberLanguage(q.doc, q.location, null)).not.toThrow();
  });
});
