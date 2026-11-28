# Next: the build queue

> Kept by the **planning chat** (Claude on claude.ai, with the owner). Worked by **Claude Code**.
> Owner's standing message to Claude Code: *"Pull main and do the next item in docs/next.md."*

## How this file works

- **The planning chat** brainstorms with the owner, writes or updates the spec in `docs/specs/`, then adds items here in order. It changes only specs, this file and other planning docs, never code.
- **Claude Code** pulls `main`, takes the **first unticked item**, reads CLAUDE.md and the spec it names, builds it (one PR per item, CI green, merge), then:
  - ticks the item here (`[x]`, date, PR number) in the same PR;
  - marks the step *(built)* in the spec's work plan;
  - if the build had to change the plan, adds a dated note under **Notes from the build**.
- An item marked ⏸ is a stop. Claude Code finishes everything before it, then waits for the owner. The planning chat removes the ⏸ when the owner approves.
- Anything only a person can check goes into `docs/test-plan.md`, as CLAUDE.md §9.10 says.
- If an item is unclear or touches money, children's data or safety, stop and ask the owner (CLAUDE.md §9.9).

## Queue

### Junior (spec `docs/specs/junior.md` v0.5, CAPS alignment approved 2026-11-28)

- [ ] **J-8a: rebase PR #143 (Grade R–2 lessons and six draft lessons).**
  - Rebase onto `main` and rename it step 8 (the spec renumbered the steps).
  - Give its three missions (`bee-first-steps`, `bus-round-corner`, `rhino-count-steps`) the fields step 3 made required: `grades` (0 = Grade R), `term`, `caps`, `kind: build` and `mode`.
    - Grades R–1 use `arrows`; Grade R Terms 1–2 use `arrows-slide`; Grade 2 uses `turns`.
    - `best` counts **cards**: a repeat number is part of its card.
  - Tag each lesson with its CAPS codes (R.1–R.7, D.1–D.10): the list, with the grades each code applies to, is in **`docs/caps-foundation-codes.md`**.
  - Keep the edits to the lesson filters, lesson page, i18n, the spec and CLAUDE.md in line with what's on `main` now: the Machines "Part" filter and "Parts in this robot" (#144), and Junior step 3 (#146).
- [ ] **J-4: mission kinds and card limits** (spec FR-12, FR-14).
  - Mission kinds: `complete` (fill the gaps), `fix` (debug a given program), `predict` (tap the square where it ends), `choose` (2–3 programs), `shorten`.
  - Exact card sets (Parsons) or a maximum number of cards; the palette shows how many are left.
  - 12 missions across Grade R Terms 1–4, Grade 1 and Grade 2, each tagged with grades, term and CAPS codes.
- [ ] **J-5: Grade 2 board features** (FR-13): things to collect, goals in order, no-go squares, start or finish outside the grid, jump, the IF coloured tile. Add 4 missions.
- [ ] **J-6: patterns** (FR-12 `pattern`): copy, complete, find the error, make your own. Add 4 missions.
- [ ] **J-7: teacher tools** (FR-15, FR-16):
  - a mission planner by grade, term and CAPS code;
  - a printable observation checklist (nicknames only) and the Annexure B rubrics;
  - teacher observations recorded with M5 records, offline-first, with no automatic marks;
  - pairs mode on the big screen.
- [ ] ⏸ **Owner review of Junior** (missions, lessons and teacher tools) before anything further on Junior.

### Machines (spec `docs/specs/machines.md` v0.3, approved)

- [x] **M-3: back office.** (2026-11-28, #148)
  - Topics become a content kind in the review flow (draft → in review → published, `reviewed_by` required).
  - Add `machines` to `content/site/withdrawn.json`.
  - Translations as `index.<lang>.md`; `npm run translation-hash` covers `index.md` and `picture.svg`.
- [ ] **M-4: starting set.**
  - The rest of the topics in spec §2: thrust washer, threaded fastener, pin and key, collar, spring, damper, flywheel, levers and linkages, cams, pulleys and belts, wheels and axles, rack and pinion, ring gear. Each is AI-drafted, marked `in_review`, with a `picture.svg` that has no words.
  - One topic lesson each for the three gear topics (idler train, rack and pinion, ring gear), with cutout templates.
  - Tag every remaining lesson with `machines`.
  - Add the build tests to `docs/test-plan.md` (B61).
- [ ] ⏸ **Owner review of the Machines content.**

### Junior stories (spec `docs/specs/junior-stories.md` v0.1, draft)

- [ ] ⏸ **Owner approves the stories spec.** If you already have stories work, push it first as a **draft PR** (don't merge it) and describe it in the PR, so the plan can be adapted to it.
- [ ] **JS-1: scenes and characters.** Content format, 6 scenes (city, neighbourhood, village, bush, garden, classroom), 12 characters as SVG, a card row per character, ▶ (S-1, S-2, S-7).
- [ ] **JS-2: Retell and the eight stories.** Picture strips, checking, stars (S-3).
- [ ] **JS-3: Make your own**, saved on the device (S-4).
- [ ] **JS-4: voices.**
  - Recording up to 5 s with the microphone released straight after.
  - Six cartoon filters (Giant, Mouse, Robot, Bee, Boy, Girl), applied **before** storage.
  - No natural voice for children; adults can switch theirs on or off.
  - Deletion on sign-out of a shared device.
  - The consent line (S-6).
  - ⏸ The lawyer checks the consent wording before this goes live.
- [ ] **JS-5: sets.** Teachers and parents set stories (S-5).
- [ ] **JS-6: big screen, offline, size and accessibility pass** (S-8, S-9).
- [ ] ⏸ **Owner review of stories.**

## Done

- [x] Machines step 1: format, library, three topics (2026-11-28, #142)
- [x] Machines step 2: Parts in this robot, cards, filters (2026-11-28, #144)
- [x] Junior step 3: CAPS ways of moving, repeat under the card, CAPS tags (2026-11-28, #146)

## Notes from the build

*(Claude Code adds dated notes here when a build changes the plan.)*

## Parked (planning chat; not for Claude Code yet)

- Funding model: project doc `funding-model_v0.1`; owner's four questions open.
- Extension folder format: after the front office is complete (CLAUDE.md §4).
- Owner setup in Cloudflare and GitHub: `ACCESS_AUD` / `ACCESS_TEAM`, `GITHUB_APP_LOGIN`, Web Analytics off, rulesets, redirects.
