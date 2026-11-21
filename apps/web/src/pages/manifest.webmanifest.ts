// Web app manifest (M1 spec FR-2): makes Robot For All installable on Android.
// Built at build time so the name and description come from the translation file.
import type { APIRoute } from 'astro';
import { m } from '../i18n';

export const GET: APIRoute = () => {
  const manifest = {
    name: m.app_name(),
    short_name: m.app_name(),
    description: m.app_description(),
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fffaf2',
    theme_color: '#8a4b14',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json' }
  });
};
