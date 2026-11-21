# ADR-0001: Web framework

- **Status:** Proposed (recommendation: Astro)
- **Date:** 2026-11-21
- **Decider:** Rashid Ishmail

## Context
Every later milestone sits on this choice. The non-negotiables that matter most (CLAUDE.md §2, M1 spec §5):
- Home page ≤ 150 KB and lesson page ≤ 250 KB compressed, on low-end Android over slow mobile data
- Works offline (service worker), no third-party requests, home languages from day one
- Builds to plain static files so hosting is free and portable

The platform is **mostly content** (lessons, project library, templates) with **a few heavy app-like tools** (block editor in M3, simulator in M4, teacher portal in M5).

## Options considered

| | **SvelteKit 3** (adapter-static) | **Astro 7** (+ Svelte islands) |
|---|---|---|
| Model | App framework; every page hydrates, client-side routing | Content framework; zero JS by default, only marked components hydrate |
| JS on a plain lesson page | Framework runtime + router + page code | Only the island(s) on that page |
| Static output | Yes (prerender everything) | Yes (default) |
| Content tooling | Build our own loader + validation | Content Collections with Zod schemas built in |
| App-heavy tools (editor, simulator, portal) | Native strength | Svelte islands per page; portal can be one large island or a separate app |
| Security headers / CSP | Via host `_headers` | Built-in CSP API (stable since Astro 6) plus host `_headers` |
| i18n | Works with Paraglide | Works with Paraglide; built-in i18n routing |
| Licence | MIT | MIT |
| Node | 22.17+ | 22+ |

Both let us write interactive parts in Svelte, so the components (editor wrapper, simulator UI, language switcher) carry over either way.

## Evidence: prototype benchmark
`prototypes/` contains the same two pages in each framework: a home page and the sample lesson with one interactive language switcher. The **ADR-001 benchmark** CI job builds both and measures what a phone downloads (HTML + CSS + JS, following imports).

Run on 2026-11-21 with the versions npm installs today: SvelteKit 3.4.0, adapter-static 4.0.1, Vite 8.3.8 · Astro 7.4.13, @astrojs/svelte 9.1.6 · Svelte 5.59.1 in both.

| Page | SvelteKit | Astro | Budget |
|---|---|---|---|
| Home (no interactive parts) | 37.0 KB gzip (10 files) | **0.2 KB** gzip (1 file) | 150 KB |
| Lesson (one interactive switcher) | 37.9 KB gzip (10 files) | **18.6 KB** gzip (4 files) | 250 KB |

What the numbers mean:
- Both are comfortably within budget, so either would work.
- SvelteKit ships about 36 KB of framework and router code on **every** page, even pages with nothing interactive.
- Astro ships **nothing** on plain pages and only the Svelte runtime plus the component where something is interactive.
- Most of our pages (lessons, project library, about, printable guides) are content, so Astro's saving repeats across most of the site. It's largest on the very first visit from a WhatsApp link, which is where cheap data hurts most.

## Decision
**Astro**, with interactive parts written as **Svelte components** (islands).

This reverses the earlier SvelteKit recommendation in CLAUDE.md and the M1 spec. The measured numbers favour Astro for a content-first platform.

## Why
- About half the download on lesson pages and almost zero on content pages, on the phones and data plans we're designing for.
- Lesson validation is built in (Content Collections with Zod), which ADR-0004 needs anyway.
- Built-in CSP support helps meet the M1 security headers.
- Interactive tools still use Svelte, so the block editor (M3), simulator (M4) and portal (M5) are written the same way they would be in SvelteKit.

## Consequences
- Each heavy tool loads only on its own page, so the editor never slows down a lesson.
- The teacher/coach/parent portal (M5) is app-like. Build it first as large Svelte islands inside Astro. If that becomes awkward, `apps/admin` or the portal can be a separate SvelteKit app sharing the same Svelte components, with no rewrite of the components themselves.
- Page-to-page navigation is plain links rather than a client-side router. That's fine for lessons and works better offline. Astro's view transitions can be added later if wanted.
- CLAUDE.md §5 and the M1 spec are updated to Astro once this ADR is accepted.
- Revisit if the portal or offline sync in M5 needs more app structure than islands handle well.
