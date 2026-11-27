import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { serviceWorker } from './src/sw/integration';
import languageList from '../../content/i18n/languages.json';
import withdrawnList from '../../content/site/withdrawn.json';
import { liveLanguages, type LanguageList } from '../../packages/settings/src/languages';
import { buildWithdrawn, isWithdrawn } from '../../packages/settings/src/withdrawn';

// Languages this build serves (more content spec §2.5): English at /, others at /<code>/,
// built from the English pages with each language's words (missing words fall back to English).
const showDrafts = process.env['SHOW_DRAFTS'] !== 'false';
const languages = liveLanguages(
  languageList as LanguageList,
  (code) => isWithdrawn(buildWithdrawn(withdrawnList), 'language', code),
  showDrafts
).map((l) => l.code);

// Static output only (ADR-0001, ADR-0002). Everything is served from one hostname.
export default defineConfig({
  output: 'static',
  i18n: {
    locales: languages,
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false, fallbackType: 'rewrite' },
    // Every other language falls back to the English page (rewritten with that language's words).
    // Astro types fallback from literal locale names; ours come from content/i18n/languages.json.
    fallback: Object.fromEntries(
      languages.filter((c) => c !== 'en').map((c) => [c, 'en'])
    ) as Record<string, never>
  },
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
    // Production (SHOW_DRAFTS=false) leaves out drafts and withdrawn items; other builds show them.
    define: { __RFA_SHOW_DRAFTS__: JSON.stringify(showDrafts) },
    build: {
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // Named chunks (rolldown code splitting; higher priority wins when a module would fit
          // two groups, since a group also takes its modules' dependencies):
          //  - micro:bit file and USB code: loads only on Download or Send;
          //  - the Svelte runtime and Vite's preload helper, shared by every island, in a small
          //    chunk of their own, so "Ask the helper" on a lesson page doesn't pull in the editor;
          //  - the code editor's libraries: the service worker leaves them out of the install
          //    download, so only learners who open /code/ pay for them.
          codeSplitting: {
            groups: [
              {
                name: 'microbit',
                priority: 30,
                test: (id: string) =>
                  /[\\/]node_modules[\\/](@microbit|nrf-intel-hex)[\\/]/.test(id) ||
                  /[\\/]src[\\/]code[\\/]hex\.ts$/.test(id)
              },
              {
                name: 'svelte',
                priority: 20,
                test: (id: string) =>
                  /[\\/]node_modules[\\/](svelte|esm-env|clsx)[\\/]/.test(id) ||
                  id.includes('preload-helper')
              },
              {
                name: 'editor-vendor',
                priority: 10,
                test: (id: string) =>
                  /[\\/]node_modules[\\/]blockly[\\/]/.test(id) ||
                  /[\\/]src[\\/](code[\\/]|components[\\/]CodeEditor\.svelte)/.test(id) ||
                  /[\\/]packages[\\/]blocks[\\/]/.test(id)
              }
            ]
          }
        }
      }
    }
  }
});
