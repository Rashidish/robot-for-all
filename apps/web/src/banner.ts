// The announcement banner's behaviour (back-office spec §6.7), apart from the page so it is
// unit-tested: show it only between its dates (South African date) and until the learner
// closes it; remember "closed" per banner, so a new banner shows again.

export const BANNER_CLOSED_KEY = 'rfa-banner-closed';

interface BannerElement {
  hidden: boolean | 'until-found';
  dataset: Record<string, string | undefined>;
  querySelector(selector: string): { addEventListener(type: string, fn: () => void): void } | null;
}
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Today in South Africa (UTC+2, no daylight saving), as YYYY-MM-DD. */
export const saToday = (now: Date): string =>
  new Date(now.getTime() + 2 * 3600_000).toISOString().slice(0, 10);

export function setupBanner(banner: BannerElement, now: Date, storage: Store | null): void {
  let closed: string | null = null;
  try {
    closed = storage?.getItem(BANNER_CLOSED_KEY) ?? null;
  } catch {
    // Storage blocked: the banner just shows.
  }
  const from = banner.dataset['from'] ?? '';
  const to = banner.dataset['to'] ?? '';
  const id = banner.dataset['id'] ?? '';
  const today = saToday(now);
  banner.hidden = !(from !== '' && today >= from && today <= to && closed !== id);
  banner.querySelector('[data-banner-close]')?.addEventListener('click', () => {
    banner.hidden = true;
    try {
      storage?.setItem(BANNER_CLOSED_KEY, id);
    } catch {
      // Storage blocked: it closes for this page only.
    }
  });
}
