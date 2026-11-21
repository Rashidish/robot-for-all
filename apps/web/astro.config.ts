import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { serviceWorker } from './src/sw/integration';

// Static output only (ADR-0001, ADR-0002). Everything is served from one hostname.
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  integrations: [svelte(), serviceWorker()],
  // No prefetching of other pages: it spends learners' data on pages they may never open.
  prefetch: false,
  build: {
    // Never inline CSS or JS: our Content-Security-Policy only allows files from our own site
    // (no 'unsafe-inline'). CI checks this with scripts/check-no-inline.mjs.
    inlineStylesheets: 'never'
  },
  vite: {
    build: { assetsInlineLimit: 0 }
  }
});
