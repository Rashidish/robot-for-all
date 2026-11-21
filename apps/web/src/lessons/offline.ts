// "Download for offline" (M1 spec FR-4): saves a lesson page and everything it uses into the
// same cache the service worker reads from, so the lesson opens later without internet.

/** Must match PAGES_CACHE in src/sw/sw-template.js. */
export const PAGES_CACHE = 'rfa-pages';

/**
 * The URLs to save for a lesson: the page itself plus its same-origin resources
 * (styles, scripts, images, templates). Other sites are never fetched or stored.
 */
export function lessonUrls(pagePath: string, resources: readonly string[], origin: string): string[] {
  const urls = new Set<string>([pagePath]);
  for (const resource of resources) {
    if (!resource) continue;
    let url: URL;
    try {
      url = new URL(resource, origin + pagePath);
    } catch {
      continue;
    }
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) continue;
    urls.add(url.pathname);
  }
  return [...urls];
}
