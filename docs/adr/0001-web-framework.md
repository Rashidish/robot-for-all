# ADR-0001: Web framework

- **Status:** Proposed
- **Date:** 2026-11-21
- **Decider:** Rashid Ishmail

## Context
Every later milestone sits on this choice. The non-negotiables that matter most (CLAUDE.md §2, M1 spec §5):
- Home page ≤ 150 KB and lesson page ≤ 250 KB compressed, on low-end Android over slow mobile data
- Works offline (service worker), no third-party requests, home languages from day one
- Builds to plain static files so hosting is free and portable

The platform is **mostly content** (lessons, project library, templates) with **a few heavy app-like tools** (block editor in M3, simulator in M4, teacher portal in M5).

## Options considered

| | **SvelteKit 3** (adapter-static) | **Astro 6** (+ Svelte islands) |
|---|---|---|
| Model | App framework; every page hydrates, client-side routing | Content framework; zero JS by default, only marked components hydrate |
| JS on a plain lesson page | Framework runtime + router + page code | Only the island(s) on that page |
| Static output | Yes (prerender everything) | Yes (default) |
| Content tooling | Build our own loader + validation | Content Collections with Zod schemas built in |
| App-heavy tools (editor, simulator, portal) | Native strength | Svelte islands per page; portal can be one large island or a separate app |
| Security headers / CSP | Via host `_headers` | Built-in CSP API (stable in Astro 6) plus host `_headers` |
| i18n | Works with Paraglide | Works with Paraglide; built-in i18n routing |
| Licence | MIT | MIT |
| Node | 22.17+ | 22+ |

Both let us write interactive parts in Svelte, so the components (editor wrapper, simulator UI, language switcher) carry over either way.

## Evidence: prototype benchmark
`prototypes/` contains the same two pages in each framework: a home page and the sample lesson with one interactive language switcher. The **ADR-001 benchmark** CI job builds both and measures what a phone downloads (HTML + CSS + JS, following imports).

| Page | SvelteKit (gzip) | Astro (gzip) | Budget |
|---|---|---|---|
| Home | _pending CI_ | _pending CI_ | 150 KB |
| Lesson | _pending CI_ | _pending CI_ | 250 KB |

## Decision
_To be written once the benchmark numbers are in._

## Consequences
_To be written with the decision._
