# CLAUDE.md — Robot For All

> **Version:** 0.6 (draft) · **Date:** 2026-11-21 · **Owner:** Rashid Ishmail
> Keep the version line above current and log changes at the bottom.

Read this file before every task. It is the source of truth for what we build, the rules that cannot be broken, and how to work in this repo. If a request conflicts with this file, stop and ask.

---

## 1. What we are building

**Robot For All** is a free or ultra-low-cost STEM and robotics learning platform.
Tagline: *"From Cardboard to Innovation: Robotics Education for Everyone."*

Learners start with cardboard, popsicle sticks, straws and one motor. They move on to controlling robots with micro:bit/ESP boards, then to designing integrated robot projects. Teachers, robotics coaches and parents get ready-made lessons, templates, parts lists and AI help.

**Who it's for**
- Learners from **Grade 3** upward (children and adult beginners)
- Teachers, robotics club coaches, STEM trainers
- Parents and guardians, homeschool families
- Schools, libraries, community centres, youth programmes

**Learning phases** (curriculum, not build milestones)
1. **Build**: one-motor robots using mechanisms (crank, gear, lever, linkage) linked to the school syllabus (CAPS maths, science, technology, history).
2. **Control**: add micro:bit / ESP boards for forward, stop, reverse, LEDs, sensors.
3. **Integrate**: cutout robot projects (e.g. rhino, drone) that combine components using the mechanics from Phases 1–2.

Each phase has many projects to choose from. Lessons follow **PRIMM** (Predict, Run, Investigate, Modify, Make) and the loop *Learn → Build → Test → Experiment → Improve → Share*.

---

## 2. Non-negotiables

Every change must keep these true. If one can't be met, say so in the PR and propose an alternative.

1. **Mobile-first, cheap phones.** Design for low-end Android, small screens and touch. Test at 360 px wide.
2. **Low data.** Aim for zero-rated educational access (e.g. Vodacom). Serve every asset from our own domain: no third-party CDNs, web fonts, trackers, ads or embedded external video unless the zero-rating terms are confirmed to cover them.
3. **Offline-capable.** Lessons, templates and the code editor keep working after first load (service worker + local storage). Progress syncs when a connection returns.
4. **Home languages.** All learner-facing text goes through i18n from day one. No hard-coded strings. English first; the language checklist is part of every project's "done".
5. **Child safety and privacy (POPIA).** Collect the minimum data. See §7.
6. **Free at the core.** Core learning never sits behind a paywall. Paid things (kits, certification, school dashboards) are add-ons.
7. **Accessible.** WCAG 2.2 AA: keyboard navigation, alt text, contrast, captions, readable fonts.
8. **Open where possible.** Prefer open-source dependencies with permissive licences. Record every licence.

---

## 3. Product map

**Front office (public)**
- Lesson player: handbook (printable PDF) and on-screen slides views of the same lesson
- Project library filtered by phase, grade, subject, mechanism, cost and language
- Printable cutout templates (A4, true scale, fold/cut lines)
- Block coding editor plus micro:bit flashing from the browser
- 2D robot and sensor simulator
- Teacher, coach and parent portal: classes, progress, badges
- AI helper for teachers, coaches and parents (advice and troubleshooting only)
- Challenges and virtual competitions (learner vs learner, club vs club, school vs school)
- Live group help sessions run by verified volunteer coaches
- Kit and supplies ordering
- Parent engagement: weekly WhatsApp question, parent badges
- Newsletter: events, competitions, results, rankings

**Back office (admin only)**
- AI project generation: designs, cutout templates, wiring diagrams, illustrations, parts lists, documents, CAPS links, translations
- CAD and template tooling runs here, never exposed to the public
- Human review and publishing workflow for all AI-generated content
- Scoring completed challenge projects by phase/level (completion, function, presentation, etc.)
- Coach verification, content moderation, kit catalogue

---

## 4. Build milestones

Ship in order. Each milestone must be usable on its own before the next starts.

| # | Milestone | Done when |
|---|---|---|
| M1 | Offline shell | PWA installs on a low-end phone, works offline, i18n wired, deploys to free/static hosting |
| M2 | Make & learn | Lesson player + template generator + 10 Phase 1 lessons as data |
| M3 | Code | Block editor + micro:bit flashing + Phase 2 lessons |
| M4 | Simulate | 2D robot/sensor simulator runs block code |
| M5 | Teach | Accounts, classes, progress, offline sync, teacher/coach/parent views |
| M6 | AI helper | Front-office AI with cost caps and child-safe rules |
| Later | Live sessions, competitions, kit store, newsletter, back-office AI generation pipeline |

Current milestone: **M1**.

---

## 5. Tech stack (decisions recorded in `docs/adr/`)

Reuse proven open source before writing our own.

| Need | Proposed choice | Why |
|---|---|---|
| Language | TypeScript (strict) | One language front to back |
| Web app | **Astro + Svelte islands** (ADR-0001) | Zero JS on content pages; Svelte only where interactive |
| Offline | Small hand-written service worker, generated at build (`apps/web/src/sw/`); IndexedDB for progress later | No dependency; every line auditable |
| Translations | **Paraglide JS 2**; English only at launch (ADR-0003) | Missing strings fail the build; tiny downloads |
| Lesson content | **Markdown + front matter, Zod-validated** (ADR-0004) | Free, reviewable, offline-friendly |
| Block coding | Blockly | Industry standard, open source |
| micro:bit | MakeCode (self-hosted if needed for zero-rating) + WebUSB flashing | Free, proven, has simulator |
| Python in browser | Pyodide (lazy-loaded, later milestones only) | No server cost |
| Simulator | Canvas 2D + small physics lib | 2D before 3D |
| Database / auth | Postgres (e.g. Supabase) | Free tier, row-level security |
| Hosting | **Cloudflare Pages**, one hostname for everything (ADR-0002) | Free unlimited static traffic; zero-rating friendly |
| AI | Claude API via our own server only | Keys never reach the browser |
| Offline platform option | Evaluate Kolibri for schools with no internet | Built for this case |

Before adding any dependency, check: bundle size, licence, works offline, works on low-end Android. Write the result in the PR.

---

## 6. Repo layout

```
/apps/web            Public front office (PWA)
/apps/admin          Back office (admin only)
/packages/ui         Shared, accessible UI components
/packages/sim        2D simulator
/packages/blocks     Blockly blocks and generators
/packages/i18n       Translation keys and loaders
/content/lessons     Lessons as Markdown + front matter (one folder per lesson)
/content/projects    Project data, parts lists, templates (SVG)
/content/i18n        Translations per language
/docs/specs          One spec per feature (write before building)
/docs/adr            Architecture decision records
/tests               End-to-end tests
```

### Lesson content (see ADR-0004)
One folder per lesson: `index.md` (English source), `index.<lang>.md` for translations, `images/` for pictures.

Front matter is metadata only:
```yaml
id: p1-crank-01
title: Crank-powered waving rhino
phase: 1                 # 1 Build | 2 Control | 3 Integrate
grades: [3, 4]
mechanism: crank         # crank | gear | lever | linkage | ...
syllabus_links:          # CAPS topic references
  - subject: Natural Sciences and Technology
    topic: Structures / mechanical systems
duration_minutes: 45
cost_estimate_zar: 15
parts: [{ item: cardboard A4, qty: 2 }, { item: straw, qty: 3 }]
templates: [rhino-body.svg]
status: draft            # draft | in_review | published (published requires reviewed_by)
ai_generated: true
reviewed_by: null
```
The body holds the five PRIMM steps as `##` headings in order: Predict, Run, Investigate, Modify, Make.
Languages are worked out from the files present, never typed by hand.
Teachers and content editors must be able to add a lesson without touching code.

---

## 7. Security, privacy and child safety

- **POPIA first.** Learners under 18 are children under POPIA: get consent from a parent or guardian, and the school where relevant. Record the legal basis for every piece of personal data.
- **Collect the minimum.** No learner surnames, photos, ID numbers, exact birthdates or locations unless a spec justifies it and it's approved.
- **Learner accounts** can be created by a teacher or parent; learners may use a nickname.
- **No personal data to AI.** Strip names and identifiers before any call to the AI. Log prompts without personal data.
- **Live sessions:** only verified coaches host; coach camera on, learner cameras off. No private 1:1 chat between adults and learners.
- **User-generated content** (projects, challenge entries, comments) is moderated before it's public.
- **Secrets** live in environment variables only. Never commit keys. Use least-privilege database roles and row-level security.
- **Threat model** every feature that touches accounts, payments, uploads or messaging (note it in the spec).
- Run dependency and secret scanning in CI. Fix high and critical findings before merging.

---

## 8. AI rules

**Front office (helper for teachers, coaches, parents)**
- Advises and troubleshoots lessons and projects. It doesn't generate public content.
- Child-safe system prompt, age-appropriate tone, stays on topic, refuses unsafe requests (e.g. mains electricity, sharp tools without adult supervision).
- Cost caps per user per day, cached answers for common questions, graceful fallback when the cap is reached or the user is offline.

**Back office (generation)**
- Generates designs, templates, wiring diagrams, documents, parts lists, CAPS links and translations.
- **Nothing AI-generated is published without human review** (`status: in_review` → `published`, `reviewed_by` set).
- Electrical designs must be checked for safe voltages and current (battery-only, low voltage).

---

## 9. How to work in this repo (Claude Code)

1. **Read** this file, the relevant spec in `/docs/specs`, and related ADRs.
2. **Plan first.** For anything bigger than a small fix, write a plan and wait for approval.
3. **No spec, no build.** If a feature has no spec, draft one (user journey, requirements, acceptance criteria, threat notes) and stop for review.
4. **Small PRs.** One feature or fix per PR, with a clear description and screenshots on a 360 px viewport.
5. **Tests are required.** Unit tests for logic, end-to-end tests for user journeys, an offline test for anything that must work offline.
6. **Performance budget:** first load of a lesson under 250 KB compressed (excluding the lesson's own images); Lighthouse mobile scores of 90+ for performance and accessibility.
7. **i18n:** every new string gets a translation key.
8. **Update docs** (spec, ADR, this file) in the same PR when behaviour or decisions change.
9. **Ask, don't guess,** when a requirement is unclear or touches money, children's data or safety.

### Commands
Node 24 (see `.nvmrc`; minimum 22.17). Run from the repo root:
```
install:   npm ci                 # exact versions from package-lock.json
dev:       npm run dev            # http://localhost:4321
check:     npm run check          # format + lint + types + unit tests (what CI runs)
test:      npm test
e2e:       npm run build && npm run e2e   # browser tests on a 360 px phone (first time: npx playwright install chromium)
lighthouse: npm run lighthouse          # performance/accessibility must be 90+
lint:      npm run lint           # npm run format to auto-fix formatting
build:     npm run build          # static site in apps/web/dist
```
Always commit `package-lock.json` changes; CI installs with `npm ci` and fails if it is out of date.

---

## 10. Don'ts

- Don't add third-party trackers, analytics SDKs, ads or external fonts/CDNs.
- Don't put AI keys or calls in client code.
- Don't expose CAD or AI generation tools in the front office.
- Don't publish AI-generated content without review.
- Don't hard-code learner-facing text.
- Don't add a heavy dependency when a few lines of code will do.
- Don't collect data "just in case".

---

## 11. Glossary

- **CAPS**: South Africa's Curriculum and Assessment Policy Statement (school syllabus)
- **PRIMM**: Predict, Run, Investigate, Modify, Make: a teaching method for coding
- **Phase 1/2/3**: learning phases (Build, Control, Integrate)
- **M1–M6**: build milestones
- **Coach**: verified volunteer who runs clubs or live help sessions
- **Zero-rated**: data costs waived by a mobile network for approved educational sites

---

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-21 | First draft |
| 0.2 | 2026-11-21 | Lesson content rules aligned with ADR-0004 (PRIMM in body, computed languages) |
| 0.3 | 2026-11-21 | Tech stack updated from accepted ADRs 0001–0004 |
| 0.4 | 2026-11-21 | Commands filled in (M1 step 2) |
| 0.5 | 2026-11-22 | Offline: hand-written service worker instead of Workbox (M1 step 6) |
| 0.6 | 2026-11-22 | Browser tests, accessibility checks, Lighthouse and size budgets run in CI (M1 step 9) |
