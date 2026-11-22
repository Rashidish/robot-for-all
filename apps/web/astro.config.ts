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
    build: {
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // The code editor's libraries go in their own file so the service worker can leave
          // them out of the install download: only learners who open /code/ pay for them.
          manualChunks(id: string) {
            if (
              /[\\/]node_modules[\\/](blockly|@microbit|nrf-intel-hex)[\\/]/.test(id) ||
              /[\\/]src[\\/](code[\\/]|components[\\/]CodeEditor\.svelte)/.test(id) ||
              /[\\/]packages[\\/]blocks[\\/]/.test(id)
            ) {
              return 'editor-vendor';
            }
            return undefined;
          }
        }
      }
    }
  }
});
