# Spec: Translate templates, diagram words and starter program names

> **Version:** 0.5 · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-24): all three recommendations
> Follows `docs/specs/back-office-more-content.md` §2.7 (lesson translations) and §2.8 (flags), where the back office lists these three as "not translatable yet". CLAUDE.md §2 rule 4: all learner-facing text goes through translation.

## 1. Purpose

A learner using the site in isiZulu still meets English in three places, in every language:

| What | Where | How much | Why it's English today |
|---|---|---|---|
| **Template sheets** (printed, cut out, handled by learners) | `content/projects/<lesson>/templates/<name>.ts` | 15 sheets with 15 titles and about 45 part names, plus notes on some parts; plus the sentences the generator writes ("Push rod: 72 mm long, 12 mm wide", "2 holes, 6 mm from each end…") | Titles, part names and notes are written in code; the generator builds its sentences in English |
| **Words inside diagrams** | `content/lessons/<lesson>/images/*.svg` | 10 words in 7 Phase 2–3 diagrams: "MOTOR DRIVER" (4), "LEFT" and "RIGHT" (2 diagrams), "servo", "robot", "finish". The rest are pin and board markings (P0, GND, VCC, A-IA, 3 V) and the name micro:bit | Drawn as text in the picture |
| **Starter program names** | `content/lessons/<lesson>/programs/*.rfa.json` | 12 names ("Follow the line") shown in the code editor's My programs | Stored in the program file |

## 2. Proposal

### 2.1 Template words travel with the lesson translation *(built 2026-11-24)*
Templates already follow their lesson (more content spec §2.1), so their words go into the **lesson translation** file, reviewed together with it, rather than a separate file per sheet:

```yaml
# content/lessons/p1-crank-01/index.zu.md (front matter, added)
templates:
  rhino-parts:
    title: "Ubhejane olunqekuzisayo: izingxenye"
    parts:                       # same order as the sheet's parts
      - { name: Umzimba kabhejane, notes: [imbobo yephivothi yekhanda ngaphambili phezulu; …] }
      - { name: Ikhanda, notes: [...] }
      - { name: Idiski ye-crank }
      - { name: Induku yokusunduza }
      - { name: Isibambo }
```
- The **build fails** when a translated sheet doesn't line up with the English one: a sheet the lesson doesn't have, a different number of parts, or notes on a part whose English has a different number of notes.
- A lesson translation without `templates:` is still valid; its sheets print in English, and the back office keeps flagging them (§2.8).

### 2.2 The generator's sentences become interface words *(built 2026-11-24: `template_fact_*`)*
The sentences the template generator writes from numbers ("{name}: {length} mm long, {width} mm wide", "{count} holes, {inset} mm from each end, {spacing} mm apart", "circle {diameter} mm across, hole in the centre", gear and cam sentences) move to translation keys with placeholders (`template_strip_size`, …). They are checked like every interface word, including the placeholder test (C2). Numbers and "mm" stay as they are.

### 2.3 One sheet per language
- Each language gets its own sheet file and page: `/templates/<lesson>/<name>.zu.svg` (beside the English file, like other files, which carry no language prefix) and `/zu/templates/<lesson>/<name>/` (English stays at `/templates/…`). *(Built 2026-11-24.)* The lesson page links to the sheet in its own language, and **Download for offline** saves that one.
- The rule is the same as for lesson text: production shows the translated sheet only when the lesson translation is published and up to date; otherwise the English sheet, as today.
- Sizes are unchanged: the shapes, true scale, check square and fold/cut lines are drawn once from the same code; only the words differ. A test checks the translated sheet's shapes are identical to the English one.

### 2.4 "Needs updating" covers the sheets too *(built 2026-11-24)*
`translated_from` (§2.7) is extended to hash the lesson's English template files as well as `index.md`. If someone renames a part or adds one, the translation turns "needs updating" and learners get the English lesson and sheets until a translator catches up. (Existing translations' `translated_from` values are updated in the same PR; they are drafts, so nothing live changes.)

### 2.5 Diagrams: no words, only marks and numbers
New rule for lesson pictures (ADR-0004 note, CLAUDE.md §6): **a diagram carries no words**. It may carry numbered callouts (explained in the lesson text, which is translated) and the markings printed on real parts (pin names, board names like L9110S or SG90, battery voltage), which must match the hardware and are the same in every language.
- *(Built 2026-11-24.)* Fix the words: "MOTOR DRIVER" becomes the board's printed name **L9110S**; "servo" becomes **SG90**; the two motors' "LEFT"/"RIGHT" become the driver's terminals **A**/**B**; the line sensors' "LEFT"/"RIGHT" become their pins **P13**/**P14**; "robot" becomes the robot's two wheels and "finish" a chequered flag. Each is already explained in the lesson's numbered list and alt text, which are translated.
- A content check fails the build when a lesson SVG contains a word that isn't on the allowed list of markings (pin names, part numbers, voltages, micro:bit).
- No per-language copies of images, so no extra data and nothing to keep in step.

### 2.6 Starter program names *(built 2026-11-24)*
A lesson translation may give its program a name: `program_name: Landela umugqa`. A translated lesson's "Open in code editor" link opens the program under that name, so it appears in My programs in the learner's language. The program itself (blocks) has no words to translate: block labels already come from the interface words.

### 2.7 Back office
- The lesson translation page (Content → Languages → <language> → <lesson>) shows each template sheet's English and translated words side by side, and the program name.
- The "not translatable yet" list (§2.8) disappears; a lesson's flag also counts untranslated sheets and a missing program name.
- The translation checklist gains no new tick: "nothing left in English" and "names of parts as used locally" already cover sheets.

## 3. Requirements
1. Every word on a printed template sheet comes from a translation (interface words or the lesson translation) in a page's language.
2. A translated sheet has exactly the same shapes, sizes and layout as the English one (test).
3. The build fails on a translated sheet that doesn't line up with the English sheet, and on a lesson diagram containing words that aren't allowed markings.
4. Production shows a translated sheet only with a published, up-to-date lesson translation; otherwise English.
5. Lesson pages link to, and save for offline, the sheet in their own language.
6. Changing an English template marks that lesson's translations "needs updating".
7. The 6 diagram words are replaced; no diagram has per-language copies.
8. A translated lesson's starter program opens under its translated name.

## 4. Security, privacy and child safety
No accounts, personal data, uploads or payments are involved; this is content and build changes only. Safety: translated template notes are reviewed with the lesson translation, under the existing "safety words are exact" tick. No new dependencies.

## 5. Acceptance criteria
- `/zu/templates/p1-crank-01/rhino-parts.svg` (drafts preview) has the isiZulu title, part names and measurement sentences; its shapes match the English sheet exactly; it prints at true scale (test plan row, printed and measured).
- A lesson translation whose `templates:` has a part too few fails the build with a clear message.
- Editing an English template file turns its lesson translations "needs updating" in the back office and on the drafts preview.
- No lesson SVG contains disallowed words (content check), and the 6 fixed diagrams still read correctly with their numbered lists.
- Opening the isiZulu "Follow the line" lesson's program shows it in My programs under its isiZulu name.
- Performance budgets are unchanged (sheets are separate files, not part of the lesson page).

## 6. Work plan (three PRs)
1. **Diagrams (small):** the 6 words replaced, the "no words" content check, the rule in ADR-0004 and CLAUDE.md.
2. **Templates:** the generator sentences as interface words (en + zu), `templates:` in lesson translations with build checks, per-language sheets and pages, `translated_from` covering template files, the back-office side-by-side view; isiZulu sheet words for the three drafted lessons.
3. **Program names:** `program_name` in lesson translations, the translated editor link, the back-office field.

## 7. Owner decisions (2026-11-24: the recommendations, all three)
1. **Where template words live:** in the lesson translation (recommended, reviewed with the lesson), or a separate file per sheet and language (reviewed on its own).
2. **Diagrams:** no words, only numbered callouts and printed markings (recommended), or per-language copies of each picture.
3. **Order:** diagrams, then templates, then program names (recommended: cheapest first, and templates are what learners hold).

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft, after the owner asked whether untranslated content is flagged |
| 0.2 | 2026-11-24 | Approved: template words in the lesson translation, diagrams without words, order diagrams → templates → program names |
| 0.3 | 2026-11-24 | §2.5 built: 10 words in 7 diagrams replaced (LEFT/RIGHT found while building); content check |
| 0.4 | 2026-11-24 | §2.1–2.4 and the template part of §2.7 built; translated sheet files are `<name>.<lang>.svg` |
| 0.5 | 2026-11-24 | §2.6 and the rest of §2.7 built: `program_name`; the "not translatable yet" list is gone (everything learners see can now be translated) |
