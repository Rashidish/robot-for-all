# Spec: Machines — how each part works, one library used everywhere

> **Version:** 0.4 · **Date:** 2026-11-28 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-28; build now)
> Depends on: lesson format (ADR-0004, CLAUDE.md §6), offline service worker (`apps/web/src/sw/`), back-office content review (`docs/specs/back-office-more-content.md`), lesson translations (§2.7 there). Brainstorm: build-plan board, "Mechanical parts: brainstorm" and "Three ways in, one set of Machines topic pages".

## 1. Purpose

Lessons teach a robot; they don't stop to explain each part inside it. A learner building the waving rhino uses a crank, a bushing and a collar, but nowhere explains what a bushing is for, and the next lesson that uses one would have to explain it again.

**Machines** is a library of **topics**, one per part or mechanism (gears, levers, cranks, bushings, springs…). Each topic explains how the part works, shows a free or cheap stand-in next to the real part, and has its own short lessons. Every lesson links to the topics it uses.

**Owner decisions (2026-11-28)**
1. Each part or mechanism is **a topic of its own, with its own lessons**. The list of topics is open and keeps growing.
2. **One library, used everywhere**: each topic is written once and appears in three places (§3).
3. The tab is called **Machines**; its page heading is **Machine library**.
4. **Build now**, alongside Junior (owner, 2026-11-28: "Go ahead").

**Assumption challenged: why not explain each part inside the lessons?** The same bushing would be written up in many lessons, drift apart, and be translated many times. A teacher looking for "springs" wouldn't know which phase to open. One topic page, linked from every lesson, is cheaper to write, review and translate, and a fix reaches every lesson at once.

## 2. Scope

**In scope**
- A **Machines tab** with the Machine library: topics grouped by family.
- **Topic pages**: how it works, stand-in and real part, a test to try, topic lessons, "Used in" (computed), CAPS links.
- **Topic lessons**: ordinary lessons (same format, PRIMM, answer sheets, review and build test) that belong to a topic.
- A **"Parts in this robot" strip** in every lesson that lists the topics it uses, each opening a **short card** without leaving the lesson.
- **Offline**: a saved lesson saves the cards of its parts.
- **Back office**: add and edit topics through the same review flow as lessons.
- **Starting set**:
  - **Gears:** gear train with an idler, rack and pinion, internal (ring) gear.
  - **Parts from the brainstorm:** bushing, thrust washer, threaded fastener, pin and key, collar, spring, damper, flywheel.
  - **Other families:** levers and linkages, cams and cranks, pulleys and belts, wheels, axles and bearings.

**Out of scope (later)**
- **Electronic parts** (LEDs, sensors, motors, the micro:bit). The same format could hold them later, as an "Electronics" family or a tab of its own.
- **Junior picture versions** of the simplest topics.
- **Kit store links** on each topic: these come with the kit store.
- **3D models and animations.** Pictures are SVG first; a small animation is allowed only if it fits the size budget (§5).

## 3. Users and journeys

**Three ways in, one set of topic pages**
1. **Machines tab** (browse): a learner opens Machines → Gears → "Gear train with an idler", reads how it works, and does the topic lesson.
2. **Lessons tab** (as now): a teacher opens the lesson "Crank-powered waving rhino". Lessons stay organised by phase and grade.
3. **Inside a lesson**: near the top, "Parts in this robot: **Crank · Bushing · Collar**". Tapping **Bushing** opens a short card (picture, two or three sentences, the stand-in) over the lesson, with "More about bushings" linking to the full topic.

**More journeys**
- **Teacher planning a term:** opens Machines → Levers to see the topic lessons and, under "Used in", every project that uses levers, with grades. Picks a topic lesson for week 1 and a project for week 2.
- **Learner offline:** saved the rhino lesson at school; at home with no data, taps **Crank** and the card still opens.
- **Content editor:** adds a topic "Ratchet" in the back office (words, stand-in, picture), sends it for review, then tags two existing lessons with it. Both lessons show the new part in their strip after publishing.

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | A **Machines** tab in the main navigation opens the Machine library at `/machines/`, with topics grouped by family. Filters by grade and language come with step 2. |
| FR-2 | Each topic has a page at `/machines/<id>/` with, in order: its picture and card, "good to know first", safety, stand-ins and the real part, how it works, try it (a quick test), topic lessons, "Used in", related topics, syllabus links. |
| FR-3 | Each topic has a **card**: one picture and at most 40 words, shown inside lessons. |
| FR-4 | Topics are content, not code: one folder per topic in `content/machines/` (§6). Editors add a topic without touching code. |
| FR-5 | A lesson lists the topics it uses in a new front-matter field `machines: [ids]`. The build fails if an id doesn't exist. A withdrawn topic is left out of the lessons' strips on the live site, so withdrawing a topic never needs its lessons changed. |
| FR-6 | A lesson shows a **"Parts in this robot"** strip when `machines` is not empty. Tapping a part opens its card in a dialog that works with keyboard and screen reader and closes back to the same place. |
| FR-7 | A topic lists its own **topic lessons** in order (`lessons: [ids]`). "Used in" is computed: every published lesson whose `machines` includes the topic, grouped by phase. |
| FR-8 | A lesson or topic can **suggest** a topic to do first (`learn_first`). The app shows "Good to know first: Bushing" and never blocks the lesson. |
| FR-9 | **Offline**: when a lesson is saved for offline use, the cards for its parts are saved with it; a visited topic page works offline like a lesson. |
| FR-10 | **Translations** work as for lessons: `index.<lang>.md` holds the translated words only, with `translated_from`. The card falls back to English with a "Not yet in your language" note. |
| FR-11 | **Pictures carry no words** (as in lessons): numbered callouts explained in the text. Every picture has alt text. |
| FR-12 | **Back office**: topics go through the same draft → in review → published flow as lessons, with `reviewed_by` required, and can be withdrawn. |
| FR-13 | The project library can filter lessons by machine (replacing the free-text `mechanism` filter over time, §6). |

## 5. Non-functional requirements

- **Size:**
  - The library page is under 60 KB compressed, excluding pictures.
  - A card adds under 8 KB to a lesson.
  - The strip and dialog add under 5 KB of JavaScript (one small Svelte island, or plain `<dialog>` with no JS where possible).
- **360 px phone:** the strip scrolls sideways; touch targets are at least 48 × 48 px.
- **WCAG 2.2 AA:** contrast, alt text, keyboard; the dialog traps and returns focus.
- **Languages:** no hard-coded strings; topic words through translations, interface words through Paraglide keys.
- **Offline:** as FR-9, with an e2e offline test.

## 6. Technical architecture

**Content**: `content/machines/<id>/index.md`, Zod-validated like lessons:
```yaml
id: bushing
title: Bushing
family: wheels-bearings   # gears | levers | linkages | cams-cranks | pulleys | wheels-bearings | springs-dampers | fasteners
grades: [4, 5, 6]
card: A sleeve the axle spins in, so it turns smoothly and the hole doesn't wear.   # ≤ 40 words
stand_ins:                # free or cheap things that work
  - { item: drinking straw, note: cut 2 cm, slide on the skewer }
real_part: bronze or plastic bushing
lessons: [p1-bushing-01]  # topic lessons, in order (ordinary lessons)
learn_first: []           # topic ids, suggestions only
related: [thrust-washer, collar]
syllabus_links: [...]     # as lessons
safety: { adult_help: false, notes: [...] }
picture_alt: A skewer axle in a straw bushing in a card frame   # picture.svg in the folder, no words
status: draft             # draft | in_review | published
ai_generated: true
reviewed_by: null
```
The body holds `## How it works` then `## Try it`; stand-ins and the real part come from the front matter. The picture is `picture.svg` in the topic folder, put inline in the page (no extra request; works offline).

**Lessons** gain one optional field, `machines: [ids]`. It is a fact, not words: `translated_from` ignores the line, so tagging a lesson doesn't stale its translations. The existing `mechanism` field stays for now. A one-off mapping fills `machines` for the 22 current lessons (crank → `crank`, gear → `gear-train`, and so on). Retiring `mechanism` is a later decision.

**Pages**:
- `apps/web/src/pages/machines/index.astro` and `[id].astro`, static, zero JS.
- The lesson page gets the strip; cards are rendered into the page as `<dialog>` elements, so they need no extra request and work offline with the lesson.

**Build checks**:
- ids exist and aren't withdrawn;
- topic lessons exist;
- no `learn_first` loops;
- card word count;
- pictures without words.

**Back office**: topics are a new content kind in the existing review flow (pull requests through the GitHub App). `content/site/withdrawn.json` gains `machines`.

**ADR**: none expected. It's the lesson format applied to a second content kind.

## 7. Security, privacy and child safety

- **No new personal data.** Topic pages are public and static. Topic lesson progress uses the existing M5 records.
- **Safety:** every topic carries safety notes. Stand-ins follow the lesson rules: never coin or button cells, never mains; adult help for craft knives, skewer points and hot glue. Damper topics say "syringes without needles".
- **AI-drafted topics** are published only after human review (CLAUDE.md §8).
- **Threat notes:** content-only feature; the risks are wrong or unsafe content (handled by review and withdrawal) and broken links (handled by build checks).

## 8. Acceptance criteria

- [ ] The Machines tab lists topics by family on a 360 px phone (e2e, accessibility check).
- [ ] A topic page shows its sections, topic lessons and a computed "Used in" (unit test on the computation, e2e on the page).
- [ ] A lesson shows "Parts in this robot"; tapping a part opens its card, Escape closes it and focus returns (e2e).
- [ ] Saved offline, a lesson's part cards open with no network (e2e offline).
- [ ] The build fails on an unknown machine id, a missing topic lesson, a `learn_first` loop and a card over 40 words (unit tests).
- [ ] Size budgets in §5 hold (CI).
- [ ] Topic text and pictures reviewed by a person; stand-ins build-tested (test plan, people check).

## 9. Work plan

Owner, 2026-11-28: build now. One PR per step; ⏸ marks a stop for review.

1. *(built 2026-11-28)* **Format and pages:**
   - topic schema and build checks (`apps/web/src/machines/`): ids, folder names, body sections, picture present and without words, links to topics and lessons, no `learn_first` circles, cards of at most 40 words;
   - `/machines/` (in the main menu and kept offline like Lessons) and `/machines/<id>/`;
   - three topics as examples: gear train (with an idler), crank, bushing; `p1-crank-01` and `p1-gear-01` list the topics they use, so "Used in" works already;
   - unit, e2e (360 px, offline) and accessibility tests; a 60 KB size budget for the library page.
2. *(built 2026-11-28)* **Inside lessons:**
   - the "Parts in this robot" strip near the top of each lesson (`MachinesStrip.astro`): each part opens its card in a `<dialog>` (Escape and Close shut it, focus returns to the part; without JavaScript the part is a link to the topic). Cards are part of the lesson page, so "Download for offline" saves them;
   - mapping: lessons tag the three example topics where they use them (`p1-crank-01`, `p1-gear-01`, `p1-cam-01`, `p1-wheel-01`, `p1-linkage-02`); the other lessons get tags as their topics arrive in step 4;
   - filters: grade on the Machine library; "Part" on the lessons list (`?machine=`).
3. *(built 2026-11-28)* **Back office:**
   - **Content → Machines** in the back office lists every topic (family, status, reviewer, change waiting); each topic's page shows its picture and card and offers the decisions. Sent for review → approved (publishes, `reviewed_by` set) or changes asked for; unpublish. A topic has **no build test**: its stand-ins are build-tested through the test plan (B61) and its topic lessons. The reviewer ticks seven items: explains it right, safety, stand-ins, picture without words, grades and plain words, CAPS links, read every section. Database: migration `0030_machine_reviews.sql` (content type `machine`, "not your own" as for lessons). The merge check accepts a pull request that changes only a topic's status lines.
   - **Withdrawal:** `content/site/withdrawn.json` takes `machine` items; the Withdrawn page lists published topics. A withdrawn topic leaves the Machine library, its page and every lesson's strip on the live site (FR-5); the drafts preview keeps it, marked.
   - **Translations** (FR-10): `content/machines/<id>/index.<lang>.md` holds `title`, `card`, `picture_alt`, `stand_ins` (item and note), `real_part`, `safety_notes`, the body with the same `##` sections, and `status`, `ai_generated`, `reviewed_by`, `translated_from`. `npm run translation-hash -- <topic id>` covers `index.md` and `picture.svg`, so new callouts mark translations "needs updating". The library, topic pages and lesson cards show the translation where one may be shown, else English with "Not yet in your language". The build fails on a translation whose stand-ins, notes, safety notes or sections don't line up with English. One draft example: `bushing` in isiZulu.
   - Found on the way: an unquoted comma in a stand-in's note lost words silently (`note: about 2 cm, slid onto the skewer`); stand-ins are now checked strictly, so the build fails instead.
   - Not yet: reviewing topic **translations** in the back office (Languages screen) and their coverage flags. They are drafts until then; a follow-up when the first topic translations are ready for review.
4. **Starting set:**
   - the rest of the topics in §2, AI-drafted and marked `in_review`;
   - one topic lesson each for the three gear topics (idler train, rack and pinion, ring gear) with cutout templates.

   ⏸ The owner reviews the content. Build tests go in `docs/test-plan.md`.

## 10. AI · 11. Revenue · 12. Risks · 13. Owner actions

**10. AI**
- The back office drafts topics, cards, stand-ins and topic lessons; all are reviewed before publishing.
- The M6 helper can answer "what does a bushing do?" from the topic text. That keeps answers consistent and cheap (the text is already written).

**11. Revenue**
- Each topic's real part becomes a kit store item later; the library doubles as the kit list.
- Core learning stays free.

**12. Risks**
- **Volume:** many topics to write and review. Mitigation: start with the parts current lessons already use, and let AI draft with human review.
- **Pictures:** clear, wordless drawings take effort. Mitigation: a few shared SVG building blocks (gear, axle, frame) reused across topics.
- **Two places to edit:** a lesson's `machines` list can go stale. Mitigation: the build check, plus "Used in" computed rather than typed.

**13. Owner actions**
- Approve this spec, or ask for changes.
- Review the first three example topics after step 1.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-28 | First draft from the build-plan brainstorm: topics with their own lessons, one library in three places, tab named Machines |
| 0.2 | 2026-11-28 | Approved; build now. Body is "How it works" and "Try it" (stand-ins from front matter); `picture.svg`; filters move to step 2; step 1 built |
| 0.3 | 2026-11-28 | Step 2 built: "Parts in this robot" with cards, grade and part filters; lessons tagged where the example topics are used (the rest with step 4) |
| 0.4 | 2026-11-28 | Step 3 built: topics reviewed and withdrawn in the back office (migration 0030), topic translations; FR-5: a withdrawn topic leaves the strips instead of failing the build |
