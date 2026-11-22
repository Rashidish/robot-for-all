# Spec: M2 — Make & Learn

> **Version:** 0.3 · **Date:** 2026-11-22 · **Owner:** Rashid Ishmail · **Status:** Approved
> Depends on: M1 (done), CLAUDE.md 0.6, ADR-0004. Keep the version line current; log changes at the bottom.

---

## 1. Purpose

Turn the working shell into something a teacher can **use in class next week**: ten tested Phase 1 lessons, printable cardboard templates that come out the right size, and a lesson player that works as a printed handbook *and* as on-screen slides.

Phase 1 is "Build": one-motor and no-motor robots made from cardboard, sticks, straws and rubber bands, using the four core mechanisms (lever, linkage, crank, gear) plus wheel and axle and cam, each linked to what learners meet in the school syllabus.

**Why this before coding (M3):** it needs no electronics, costs almost nothing, and works for a class with one printer or none. It is the cheapest way to reach the most learners first.

---

## 2. Scope

### In scope
1. **Richer lesson format**: learning outcomes, safety notes, assessment checklist, prerequisites/next lesson, materials with cheap substitutes, teacher notes.
2. **Lesson player**: handbook view (screen + A4 print, already there, improved) and a new **slides view** of the same lesson for projectors and shared phone screens.
3. **Template generator**: build-time code that draws parametric, true-scale A4 cutout templates (gears, cranks, strips, wheels, cams, animal bodies) as SVG, with cut/fold/hole marks, measurements and a print-size check square.
4. **Template pages**: view, print at 100%, and save offline; each lesson links its templates.
5. **Lesson library**: filter by grade, mechanism and cost (works without JavaScript).
6. **Ten Phase 1 lessons** (§7), each with templates and simple line diagrams, drafted by Claude and **published only after human review and a real build test**.

### Out of scope (later)
Electronics and micro:bit (M3), simulator (M4), accounts and progress (M5), AI helper (M6), kit ordering, translations, video, photos of real builds (welcome as soon as available).

---

## 3. Users and journeys

**Thandi, Grade 4 teacher** (one shared printer at school, prepaid data):
1. On Sunday evening she filters **Lessons** by *Grade 4*, opens "Snapping crocodile", reads the outcomes, safety box and parts list (all classroom scraps), taps **Download for offline**.
2. She opens the **crocodile template**, checks the print-size square measures 50 mm, and prints 30 copies at school.
3. In class, with no signal, she opens the **slides view** on her phone and casts or shows it; each slide is one PRIMM step with a diagram.
4. At the end she uses the **assessment checklist** to see who can explain *pivot* and *effort*.

**Sipho, robotics club coach** (no printer): opens the template page and uses the **measurements** to draw the parts with a ruler on cereal-box card.

**A parent at home**: picks a lesson by cost ("under R10") and builds it with their child on the weekend using the handbook view on a phone.

---

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Lesson front matter adds: `outcomes` (2–4), `safety` (notes + `adult_help: true/false`), `assessment` (3–5 "I can…" checks), `prerequisites` and `next` (lesson ids), `materials` with optional `substitute` per part, `concepts` (vocabulary words). Validated by the schema; build fails on errors |
| FR-2 | Lesson body may include `## Teacher notes` after Make; the PRIMM check still requires the five steps in order |
| FR-3 | Handbook view shows outcomes, safety box (highlighted when adult help is needed), parts with substitutes, PRIMM steps, assessment checklist, syllabus links, templates and next lesson |
| FR-4 | **Slides view** at `/lessons/<id>/slides/`: title slide, one slide per PRIMM step, safety slide, "You will need" slide, review slide. Swipe or arrow keys, works offline, no JavaScript required to read |
| FR-5 | Template generator produces SVG at build time from typed parameter files in `content/projects/<id>/templates/*.ts`, in **millimetres at true scale**, fitting A4 portrait with 10 mm margins |
| FR-6 | Every template sheet has: cut lines (solid), fold lines (dashed), hole marks (cross), part labels, key measurements in mm, and a **50 mm print-size check square** with "Print at 100% / Actual size" |
| FR-7 | Template page `/templates/<id>/` shows the sheet, a print button, the measurements list for hand drawing, and is saved by **Download for offline** together with its lesson |
| FR-8 | Generators for: gear (teeth count, pitch), crank disc (offset holes), strip (length, hole spacing), wheel (diameter, axle hole), cam (shape, lift), and animal body silhouettes |
| FR-9 | Lessons list filters by grade, mechanism and cost band using plain links (e.g. `/lessons/?grade=4` works by showing all with JS off; with JS, filters instantly) |
| FR-10 | Lessons link forward (`next`) and back (`prerequisites`), forming a learning path through Phase 1 |
| FR-11 | Only `published` lessons and their templates appear in production (existing rule); previews show drafts for review |

---

## 5. Non-functional requirements

- Same budgets as M1: lesson page ≤ 250 KB gzip excluding its images; template SVG ≤ 80 KB each; Lighthouse ≥ 90.
- Templates print correctly from Chrome on Android, Chrome/Edge on Windows, and when saved as PDF.
- Works on a 360 px phone; slides readable on a projector (large type).
- All new interface text in `en.json`; lesson text stays in lesson files.
- Every lesson costs **≤ R30** in materials per learner (motor lesson ≤ R60), with a "free scraps" substitute wherever possible.

---

## 6. Technical design

```
content/lessons/<id>/index.md          lesson (front matter + PRIMM body)
content/lessons/<id>/images/*.svg      line diagrams (≤ 80 KB)
content/projects/<id>/templates/*.ts   template parameters (typed)
packages/templates/                    generators: gear, crank, strip, wheel, cam, body
        └── build step → apps/web/dist/templates/<id>/<name>.svg + template page
apps/web/src/pages/lessons/[id]/slides.astro   slides view
```

- **Generators are plain TypeScript functions** returning SVG strings (no CAD library, no browser code). They run only at build time, so the "CAD in the background, never exposed" rule holds and learners download only finished SVGs.
- `packages/templates` becomes the first shared package (unit-tested geometry: sizes in mm, gear tooth spacing, holes inside parts, everything fits A4).
- Animal bodies are SVG path data in the parameter files (drawn by Claude in the back office, reviewed like lessons).
- Slides use CSS scroll-snap (no slide library). A ~1 KB script adds arrow keys and a page counter.
- Filters: static list plus a tiny progressive script.
- Schema changes are backwards compatible; the sample lesson is rewritten as a real lesson.

---

## 7. The ten Phase 1 lessons

A path from Grade 3 to Grade 7. Lessons link to the **CAPS Coding and Robotics** outcomes (Intermediate Phase, Oct 2025: Motion; R.3 components such as grippers; R.5–R.7 design, build and test; actuators and power sources). Maths, NST and History links stay marked "to confirm" until a teacher checks them.

| # | Id | Lesson | Mechanism | Grades | Big idea (syllabus link to confirm) | Approx. cost |
|---|---|---|---|---|---|---|
| 1 | `p1-lever-01` | Snapping crocodile | Lever, pivot | 3–4 | Pivot, effort, load; push and pull forces | R0–5 |
| 2 | `p1-wheel-01` | Rolling cardboard cart | Wheel and axle | 3–4 | Friction, rolling; **history of the wheel** | R5 |
| 3 | `p1-crank-01` | Crank-powered waving rhino | Crank | 3–4 | Turning motion into up-and-down motion | R5 |
| 4 | `p1-linkage-01` | Extending grabber | Scissor linkage | 4–5 | Linkages multiply movement; measuring length | R5 |
| 5 | `p1-cam-01` | Bouncing animal box | Cam and follower | 4–5 | Cams change motion; shapes and circles | R10 |
| 6 | `p1-lever-02` | Robot arm with three lever types | Levers (classes 1–3) | 5–6 | Lever classes; balancing and ratios | R10 |
| 7 | `p1-linkage-02` | Waving robot (four-bar linkage) | Four-bar linkage | 5–6 | Fixed and moving links; angles | R10 |
| 8 | `p1-gear-01` | Spinning gear train | Gears | 5–7 | Gear ratios as fractions; direction of turn | R10 |
| 9 | `p1-pulley-01` | Rubber-band pulley lift | Pulley and belt | 5–7 | Pulleys, speed vs force | R15 |
| 10 | `p1-motor-01` | One-motor scribble robot | Motor + offset weight | 5–7 | Simple electric circuit; energy transfer; vibration | R40–60 |

Lesson 10 is the bridge to Phase 2: it introduces a battery, a switch and one small DC motor, ready to be controlled by a micro:bit in M3.

**Each lesson must include:** PRIMM steps written for the stated grade, 2–4 outcomes, safety notes, an "I can…" checklist, parts with free substitutes, at least one template, 2–4 step diagrams, teacher notes (timing, common problems), and prerequisites/next.

---

## 8. Safety and child protection

- **Batteries: AA or AAA in a holder with a switch only. Never coin or button cells** (they cause serious injury if swallowed). No mains power, ever.
- Craft knives, skewers and hot glue are marked `adult_help: true` and shown in a highlighted safety box; glue sticks, tape and safety scissors are the default.
- No photos of children anywhere in lessons. Future real-build photos show hands and robots only, with consent.
- Every lesson is AI-drafted, so publication requires (a) a human content review and (b) **a real build by a person following only the printed lesson**, recorded in front matter (`reviewed_by`, plus `build_tested_by`).

---

## 9. Acceptance criteria (M2 done when)

- [ ] Schema, handbook view and slides view shipped with unit and browser tests (including offline slides and 360 px layout)
- [ ] Template generator ships with geometry tests; every sheet has the 50 mm check square, fits A4 and is ≤ 80 KB
- [ ] A printed check square measures 50 mm ± 1 mm from Chrome on Android and on Windows (owner check)
- [ ] Ten lessons merged as drafts with templates and diagrams, each with a preview link
- [ ] Each lesson **reviewed and build-tested by a person**, then marked `published`
- [ ] Syllabus links confirmed by a teacher (or marked "general" where no clean match exists)
- [ ] Lesson library filters work with and without JavaScript
- [ ] Lighthouse ≥ 90 and size budgets met on lesson, slides and template pages

---

## 10. Work plan (one pull request each; ⏸ = owner review)

1. ~~Lesson format v2: schema, validation, handbook view updates, docs~~ ✅ Done
2. ~~`packages/templates`: generators, geometry tests, template pages, print check~~ ✅ Done. The package is imported by path rather than as an npm workspace (no build step needed)
3. ~~Slides view + library filters + learning-path links~~ ✅ Done
4. ~~Lessons 1–3 (drafts, templates, diagrams)~~ ✅ Merged as drafts (PR #21)
5. ~~Lessons 4–6 (drafts, templates, diagrams)~~ ✅ Merged as drafts
6. Lessons 7–10
7. Publishing pass: after the deferred checks in `docs/test-plan.md`, apply feedback and mark lessons `published` ⏸

**Owner decision (2026-11-22):** to save time, people-based checks (content review, build tests, CAPS confirmation, print and device checks) are **deferred** to `docs/test-plan.md` and run when the full application is done. Until then only automated tests gate merging, and the live site keeps hiding unreviewed lessons.

---

## 11. AI opportunities

- Back office (now, via Claude Code): drafting lessons, template parameters, diagrams and teacher notes, always as reviewable pull requests.
- Later (M6): the AI helper answers "my crocodile jaw won't close" using the lesson's teacher notes as grounding.

## 12. Revenue notes (core stays free)

- Printed lesson packs and pre-cut template sets for schools (print-on-demand).
- Low-cost kits per lesson pack (needed anyway for lesson 10's motor).
- Sponsored lesson packs (e.g. a company sponsors "Grade 5 gears" for a district).

## 13. Risks

| Risk | Mitigation |
|---|---|
| AI-drafted mechanisms don't work when built | Mandatory real build test before publishing; teacher notes capture fixes |
| Syllabus links wrong | Teacher confirms each link; "general" allowed |
| Printer scaling makes parts the wrong size | 50 mm check square, "Actual size" instructions, mm measurements for hand drawing |
| Diagrams unclear | Diagrams reviewed with the lesson; replace with real-build photos (hands and robots only) later |
| Safety incidents | No coin cells or mains; adult-help flags; safety box on handbook and slides |
| Reviewer bottleneck (one person) | Recruit 2–3 teachers or coaches as reviewers; review can be done in the preview link on a phone |

## 14. Owner actions

- **Choose reviewers**: you and/or 1–3 teachers or coaches who will read each lesson in its preview link.
- **Arrange build tests**: someone builds each lesson from the printed handbook only (a club session works well).
- **Print check**: print one template and measure the 50 mm square.
- **Teacher to confirm CAPS links** for the ten lessons.

---

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-22 | First draft |
| 0.2 | 2026-11-22 | Approved; people-based checks deferred to `docs/test-plan.md`; CAPS Coding and Robotics links |
| 0.3 | 2026-11-22 | Step 5 done: lessons 4–6 |
