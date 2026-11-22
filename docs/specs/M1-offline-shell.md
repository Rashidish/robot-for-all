# Spec: M1 — Offline Shell

> **Version:** 0.2 (draft) · **Date:** 2026-11-21 · **Owner:** Rashid Ishmail
> Keep the version line current; log changes at the bottom.
> **Depends on:** `CLAUDE.md` v0.1 · **Status:** Draft, awaiting approval

---

## 1. Purpose

Build the foundation every later feature sits on: a fast, installable web app that works on cheap Android phones, keeps working offline, supports home languages from day one, and costs almost nothing to host.

M1 has **no accounts, no AI and no database**. It proves the hard non-negotiables (low data, offline, i18n, accessibility, privacy) before any features are built on top.

**Why this first:** if the shell is heavy, online-only or English-only, every later feature inherits that and it's expensive to fix. Getting it right now is cheap.

---

## 2. Scope

### In scope
- App shell: header, language switcher, home page, "About", "Offline" page, footer with privacy notice
- Installable PWA (add to home screen) with app icon and splash
- Offline support via service worker: shell and visited pages work with no connection
- **One sample lesson** (from `/content/lessons`) rendered from Markdown, to prove the content pipeline and offline caching
- i18n plumbing with **English only** at launch, plus a pseudo-locale for testing. Every string still goes through translation keys, so adding a language later is a content change, not a code change
- "Download for offline" button on the sample lesson
- Print stylesheet (the lesson prints cleanly on A4)
- CI: lint, type-check, unit tests, end-to-end tests, Lighthouse, bundle-size check, dependency and secret scanning
- Deploy to free static hosting on the Robot For All domain, with HTTPS

### Out of scope (later milestones)
Accounts, progress tracking, template generator, block coding, simulator, AI helper, payments, live sessions, analytics.

---

## 3. Users and journeys

**Primary persona:** Thandi, Grade 4 teacher in a township school. Uses a low-end Android phone on prepaid data and has patchy signal at school.

**Journey A: first visit (online)**
1. Thandi opens the link from a WhatsApp message.
2. The home page loads quickly on mobile data and shows "Robot For All" with a short promise and one sample lesson.
3. A prompt offers "Add to home screen". She accepts.

**Journey B: preparing for class**
1. She opens the sample lesson and taps "Download for offline".
2. She sees "Saved for offline ✓".

**Journey C: in class with no signal**
1. She opens Robot For All from her home screen in airplane mode.
2. The app opens; the sample lesson shows in full, with images.
3. A page she never opened shows a friendly offline page in her language: "You're offline. Saved lessons are still available."

**Journey D: printing**
1. At home she prints the lesson; it fits A4 with no navigation, buttons or cut-off images.

---

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | App loads and is usable on a 360 × 640 viewport with touch only |
| FR-2 | Web app manifest, icons (192/512, maskable), theme colour; installable on Android Chrome |
| FR-3 | Service worker precaches the app shell; visited pages are cached (stale-while-revalidate) |
| FR-4 | "Download for offline" caches a lesson and all its assets; shows progress and success/failure |
| FR-5 | Offline fallback page for uncached routes, translated |
| FR-6 | When a new version is deployed, users see a small "Update available — refresh" notice; no silent breakage |
| FR-7 | Language switcher, shown only when more than one language is available. At launch: English only; pseudo-locale in development builds. Choice saved on device. Defaults to device language if supported, else English |
| FR-8 | All UI text comes from translation files; build fails if a key is missing in English |
| FR-9 | Lesson pages are built from `/content/lessons/*.md` with front matter per the CLAUDE.md schema; invalid front matter fails the build |
| FR-10 | Print stylesheet for lessons (A4, hides navigation) |
| FR-11 | Privacy page: what's stored on the device (language choice, saved lessons) and that nothing is tracked |
| FR-12 | Works with JavaScript disabled for reading content (progressive enhancement); offline features need JS |

---

## 5. Non-functional requirements

| Area | Target |
|---|---|
| First load (home) | ≤ 150 KB compressed total (HTML + CSS + JS + fonts) |
| Lesson page | ≤ 250 KB compressed excluding the lesson's own images; images in WebP/AVIF, lazy-loaded, ≤ 80 KB each |
| Speed | Largest Contentful Paint < 2.5 s on Lighthouse "slow 4G, mid-tier mobile" |
| Lighthouse (mobile) | Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA checks pass |
| Accessibility | WCAG 2.2 AA; keyboard and screen-reader tested; tap targets ≥ 44 px |
| Fonts | System font stack only (no web fonts) |
| Third parties | None. Every asset is served from our own domain (zero-rating readiness) |
| Browsers | Android Chrome (last 3 years), Samsung Internet, KaiOS-class browsers degrade gracefully; desktop Chrome/Firefox/Safari/Edge |
| Cost | ≤ R0/month hosting at expected M1 traffic (free tier) |

---

## 6. Technical architecture

```
Browser (PWA)
 ├─ Static HTML pages (prebuilt)        ← lessons, home, about, privacy
 ├─ Small JS islands                    ← language switcher, offline download, update notice
 ├─ Service worker (hand-written)       ← precache shell, runtime cache lessons
 └─ Cache Storage + localStorage        ← saved lessons, language choice
        ▲
        │ HTTPS, own domain only
Static hosting / edge CDN (free tier)
        ▲
CI (GitHub Actions): lint → types → unit → build → e2e → Lighthouse → size → deploy
```

**Decisions (accepted 2026-11-21):** Astro + Svelte islands (ADR-0001), Cloudflare Pages on a single hostname (ADR-0002), Paraglide JS 2 with English only at launch (ADR-0003), Markdown + Zod content pipeline (ADR-0004).

**Repo:** set up the monorepo layout from CLAUDE.md §6. M1 only fills `/apps/web`, `/packages/ui`, `/packages/i18n`, `/content`, `/docs`, `/tests`.

---

## 7. Content for M1

- One Phase 1 sample lesson: **"Crank-powered waving rhino"** (`p1-crank-01`), with the full front matter, PRIMM sections, parts list and one placeholder template image.
- The lesson text can be a short placeholder written by Claude, marked `status: draft`, `ai_generated: true`. It only exists to test the pipeline; the real lesson is written in M2.

---

## 8. Security and privacy

- No accounts, cookies, analytics or personal data in M1.
- Strict security headers: Content-Security-Policy (`default-src 'self'`), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (camera, mic and location off).
- Service worker scope limited to the app; cache names versioned and old caches cleaned up.
- Dependabot (or equivalent) plus secret scanning in CI; high/critical findings block merges.
- **Threat notes:** cache poisoning (only cache same-origin GET responses with status 200), stale content after a fix (FR-6 update notice), domain hijack (registrar lock, 2FA on registrar and hosting accounts, owner holds the credentials).

---

## 9. Acceptance criteria (definition of done)

- [x] ADR-001 to ADR-004 written and approved
- [ ] All FR-1 to FR-12 pass end-to-end tests (Playwright) on a 360 px mobile emulation
- [ ] Offline test: install, go offline, reopen, sample lesson loads in full; unvisited page shows the translated offline page
- [ ] Update test: deploy a new version; the update notice appears and refreshing loads it
- [ ] Lighthouse CI meets §5 on every PR; the build fails if the size budgets are exceeded
- [ ] Missing English translation key fails the build; pseudo-locale shows no untranslated text
- [ ] Manual check on a real low-end Android phone (owner), on mobile data and in airplane mode
- [ ] Screen-reader pass (TalkBack) on home and lesson pages
- [ ] Lesson prints cleanly on A4
- [ ] No request leaves our own domain (verified in e2e via network log)
- [ ] Live on the Robot For All domain over HTTPS
- [ ] README has install, dev, test and deploy commands; CLAUDE.md §9 commands filled in

---

## 10. Work plan for Claude Code

Each item is one PR. Stop for review where marked ⏸.

1. ~~Write ADR-001 to ADR-004 with small prototypes~~ ✅ Done (PR #3)
2. ~~Monorepo scaffold, TypeScript strict, lint, format, CI skeleton~~ ✅ Done (PR #4)
3. ~~App shell layout + accessible UI basics~~ ✅ Done (PR #7). Styles and components live in `apps/web/src` until a second app needs them; then they move to `/packages/ui`
4. ~~Translations wired through Paraglide JS (English only)~~ ✅ Done (PR #8). The language switcher is built when the second language arrives; the pseudo-locale arrives with the browser tests in step 9, where it is used
5. ~~Content pipeline + schema validation + sample lesson page + print stylesheet~~ ✅ Done (PR #9)
6. ~~PWA manifest, icons, service worker, offline page, update notice~~ ✅ Done (hand-written ~100-line service worker instead of Workbox: no dependency, fully auditable)
7. ~~"Download for offline" for lessons~~ ✅ Done
8. ~~Security headers, privacy page~~ ✅ Done. CSP allows only our own files (no inline code, checked in CI)
9. ~~Playwright e2e (incl. offline and no-third-party checks), Lighthouse CI, size budgets~~ ✅ Done. Pseudo-locale is a browser test that lengthens every text by 40% and checks pages still fit 360 px
10. ~~Deploy to hosting~~ ✅ Live on Cloudflare Pages (`robot-for-all.pages.dev`). Custom domain: owner to connect (`docs/deploy.md` §4)

---

## 11. AI opportunities (later, not in M1)

- Back office: AI drafts lessons and translations straight into `/content` as `status: draft` for human review.
- Use the pseudo-locale and translation checks to spot gaps that the AI translation step then fills.

## 12. Revenue notes

None in M1. Keeping the shell free of third parties and lightweight is what makes zero-rating and school/NGO partnerships possible later.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Zero-rating rules unknown | Owner contacts Vodacom early; keep everything self-hosted so we can comply |
| Translations added later break layouts (longer words) | Pseudo-locale lengthens text by ~40% in testing, so layouts are proven before real translations arrive |
| Service worker bugs leave users on stale versions | Versioned caches, update notice, kill-switch service worker ready to deploy |
| Budgets too tight for later features | Budgets apply per page; heavy tools (editor, simulator) load only on their own pages |
| Free hosting limits change | Static output is portable; any static host works |

## 14. Owner actions

- Register the domain (registrar lock + 2FA)
- Create GitHub organisation/repo and hosting account; give Claude Code repo access
- Test on a real low-end Android phone
- Ask Vodacom about zero-rating requirements

---

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-21 | First draft |
| 0.2 | 2026-11-21 | English only at launch; translations added later (ADR-0003) |
