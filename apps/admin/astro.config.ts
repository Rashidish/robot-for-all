import cloudflare from '@astrojs/cloudflare';
import { defineConfig, envField } from 'astro/config';

// The back office (ADR-0009, ADR-0011): server-rendered pages in a Cloudflare Worker on
// admin.robotsforall.org.za, behind Cloudflare Access. Plain HTML forms, no page scripts.
export default defineConfig({
  output: 'server',
  // No image processing (the admin has no images to transform; Cloudflare Images can cost money).
  adapter: cloudflare({ imageService: 'passthrough' }),
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // Forms only accept posts from this site (protects against cross-site form posts).
  security: { checkOrigin: true },
  build: {
    // Our Content-Security-Policy allows no inline styles or scripts.
    inlineStylesheets: 'never'
  },
  vite: { build: { assetsInlineLimit: 0 } },
  env: {
    schema: {
      // Set as Worker secrets by the owner (docs/deploy.md); never sent to the browser.
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'secret' }),
      ACCESS_TEAM: envField.string({ context: 'server', access: 'secret', optional: true }),
      ACCESS_AUD: envField.string({ context: 'server', access: 'secret', optional: true }),
      // The GitHub App that opens content pull requests (ADR-0009; docs/deploy.md §5).
      GITHUB_APP_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_APP_PRIVATE_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      }),
      GITHUB_INSTALLATION_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      }),
      // The App's own login on GitHub, e.g. "robots-for-all-back-office[bot]" (ADR-0012 check 1).
      GITHUB_APP_LOGIN: envField.string({ context: 'server', access: 'public', optional: true }),
      // The drafts preview behind Cloudflare Access (content review spec §6.2).
      DRAFTS_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'https://drafts.robotsforall.org.za'
      }),
      GITHUB_REPO: envField.string({
        context: 'server',
        access: 'public',
        default: 'Rashidish/robots-for-all'
      })
    }
  }
});
