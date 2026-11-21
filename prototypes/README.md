# ADR-001 prototypes (temporary)

Two throwaway builds of the **same two pages** so the framework choice rests on measured numbers, not opinion:

- `/` — home page with a link to the sample lesson
- `/lessons/p1-crank-01/` — the sample lesson rendered from `content/lessons/p1-crank-01/index.md`, plus one interactive language switcher (the same Svelte component, copied into each `src/lib/`)

| Folder | Stack | How the switcher runs |
|---|---|---|
| `sveltekit/` | SvelteKit + adapter-static, fully prerendered | Whole page hydrates (SvelteKit's normal model) |
| `astro/` | Astro + @astrojs/svelte | Only the switcher hydrates (`client:load` island) |

The **ADR-001 benchmark** workflow builds both on every PR that touches `prototypes/` and writes compressed sizes to the job summary.
Dependencies use `latest` on purpose: this measures what we would install today. Resolved versions are printed in the job log.

Delete this folder in M1 step 2, once ADR-001 is accepted.
