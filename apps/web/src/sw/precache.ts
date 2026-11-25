// Decides which built files the service worker downloads on install (the "app shell").
// Lesson pages are NOT precached: they are cached when visited, or with "Download for offline".

/** Pages every visitor gets offline, as URL paths. */
export const SHELL_PAGES = ['/', '/offline/', '/about/', '/lessons/'] as const;

/**
 * Code editor files (M3 spec §5): cached when a learner first opens /code/, not on install,
 * so visitors who never code don't spend data on them. The micro:bit file and USB code
 * (`microbit`) is fetched and cached on the first Download or Send.
 */
export const EDITOR_ASSET = /^_astro\/(editor-vendor|microbit)\./;

/** Turns built file paths (relative to dist, using "/") into the precache URL list. */
export function precacheList(distFiles: readonly string[]): string[] {
  const assets = distFiles
    .filter(
      (f) =>
        (f.startsWith('_astro/') && !EDITOR_ASSET.test(f)) ||
        f.startsWith('icons/') ||
        f === 'favicon.svg' ||
        f === 'manifest.webmanifest' ||
        // Answer sheet codes, so learners can record a sheet offline (answer-sheets Part B).
        f === 'sheets.json'
    )
    .map((f) => `/${f}`);
  return [...SHELL_PAGES, ...assets.sort()];
}

/** Fills the service worker template. */
export function renderServiceWorker(template: string, version: string, urls: string[]): string {
  if (!template.includes('__VERSION__') || !template.includes('__PRECACHE__')) {
    throw new Error('Service worker template is missing its placeholders');
  }
  return template
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__PRECACHE__', JSON.stringify(urls));
}
