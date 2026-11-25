/* Robots For All service worker (M1 spec FR-3, FR-5, FR-6).
 * Generated at build time from apps/web/src/sw/sw-template.js; VERSION and PRECACHE are filled in.
 * Rules: same-origin GET only; only successful (200, same-origin) responses are cached;
 * a new version waits until the learner taps "Update" (never swaps pages mid-lesson).
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const OFFLINE_URL = '/offline/';
const SHELL_CACHE = `rfa-shell-${VERSION}`;
const PAGES_CACHE = 'rfa-pages';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('rfa-shell-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function cacheable(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function fromNetworkAndStore(request, cacheName) {
  const response = await fetch(request);
  if (cacheable(response)) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

// Pages: answer from cache straight away if we have it (fast on slow data), refresh it in the
// background; otherwise go to the network; if that fails, show the offline page.
async function handlePage(event) {
  const cached = await caches.match(event.request, { ignoreSearch: true });
  const network = fromNetworkAndStore(event.request, PAGES_CACHE);
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  try {
    return await network;
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

// Build assets have content hashes in their names, so a cached copy is always correct.
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fromNetworkAndStore(request, PAGES_CACHE);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Account data (M5, ADR-0017) and the certificate service (ADR-0015) go straight to the
  // network: never cached or answered here.
  if (url.pathname.startsWith('/db/')) return;
  if (url.pathname.startsWith('/cert/')) return;
  if (url.pathname.startsWith('/signin/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handlePage(event));
  } else if (
    url.pathname.startsWith('/_astro/') ||
    // Code editor files (M3): firmware names include their version, so a saved copy stays correct.
    url.pathname.startsWith('/firmware/') ||
    url.pathname.startsWith('/blockly-media/') ||
    // The on-screen micro:bit: each version lives in its own folder.
    url.pathname.startsWith('/simulator/') ||
    PRECACHE.includes(url.pathname)
  ) {
    event.respondWith(handleAsset(request));
  } else {
    // Anything else from our site (template SVGs, lesson images): use a saved copy if there is
    // one (e.g. from "Download for offline"), otherwise the network. Not stored automatically.
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
