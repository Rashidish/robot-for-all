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
    // Inline small CSS to save a request on slow connections.
    inlineStylesheets: 'auto'
  }
});
