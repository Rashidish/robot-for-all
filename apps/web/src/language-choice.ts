// Remembers the learner's language on this device (ADR-0003, more content spec §2.5): tapping a
// language stores it; opening the site in another language then goes to the stored one. Kept
// apart from the page so it is unit-tested.

export const LANGUAGE_KEY = 'rfa-language';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
interface Doc {
  documentElement: { lang: string };
  querySelector(s: string): { getAttribute(name: string): string | null } | null;
  querySelectorAll(s: string): ArrayLike<{
    getAttribute(name: string): string | null;
    addEventListener(type: string, fn: () => void): void;
  }>;
}

export function rememberLanguage(
  doc: Doc,
  location: Pick<Location, 'replace'>,
  storage: Store | null
): void {
  const nav = doc.querySelector('[data-languages]');
  if (!nav) return;
  const available = (nav.getAttribute('data-languages') ?? '').split(' ');
  const links = Array.from(doc.querySelectorAll('[data-lang]'));
  for (const link of links) {
    link.addEventListener('click', () => {
      try {
        storage?.setItem(LANGUAGE_KEY, link.getAttribute('data-lang') ?? '');
      } catch {
        // Storage blocked: the choice lasts for this visit only.
      }
    });
  }
  let wanted: string | null = null;
  try {
    wanted = storage?.getItem(LANGUAGE_KEY) ?? null;
  } catch {
    return;
  }
  if (!wanted || wanted === doc.documentElement.lang || !available.includes(wanted)) return;
  const target = links.find((l) => l.getAttribute('data-lang') === wanted)?.getAttribute('href');
  if (target) location.replace(target);
}
