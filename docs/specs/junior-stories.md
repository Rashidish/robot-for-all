# Spec: Junior stories: characters, scenes and voices

> **Version:** 0.2 · **Date:** 2026-11-28 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-28: "Go with all")
> Depends on: Junior (`docs/specs/junior.md`: picture cards, tap-to-add row, sign-in with QR card, big screen, CAPS tags), M5 classes, families and records (`docs/specs/M5-teach.md`, `docs/specs/M5-family-and-personal.md`). Brainstorm: build-plan board, "Junior stories: character voices".

## 1. Purpose

Junior's grid mode teaches puzzle thinking: one robot, one goal, a best route. **Stories** add creative coding for Grades R–2, in the style of ScratchJr. A child puts characters into a scene and gives each one a row of the same picture cards: move, turn, jump, say something, make a sound, wait. Then they tap ▶ and the characters act out a story.

**Owner decisions (2026-11-28)**
1. Stories are built **now**, not after the Junior launch (this replaces the reminder in CLAUDE.md §4).
2. Both ways of playing:
   - **Retell**: act out a given story, following a picture strip.
   - **Make your own**: a free scene with no right answer.
3. All **eight stories** (§4) are available. **Teachers and parents set stories** for their class or child; free-form stays open to everyone.
4. Scenes include a **city** and an **ordinary neighbourhood**, not only rural settings: not every learner lives in the countryside.
5. Children's voices go through a **voice filter on the device before anything is saved**:
   - six cartoon voices;
   - no natural voice for children;
   - the microphone is on only during the 5-second recording;
   - adults choose natural voice on or off for their own narration (§5).

**Why it matters:** the CAPS Foundation Phase asks Grade R–2 learners to put picture stories in order (C.1) and to keep personal information safe (D-codes). Retell stories do both, and Make-your-own gives children something of their own to show the class.

## 2. Scope

**In scope**
- A **Stories** section inside Junior: scenes, characters, picture cards for each character, ▶ to play.
- **Retell** stories with a 3–4 picture strip, checked against what the child built; stars as in grid mode.
- **Make your own**: free scenes, saved on the device.
- **Story sets:** a teacher sets stories for a class, a parent for their child.
- **Voices:** record up to 5 seconds on the 🎤 card, choose one of six cartoon voices, keep the filtered sound only.
- Eight stories (§4) and six scenes (§3).
- Big screen (projector) and offline, as the rest of Junior.

**Out of scope (later)**
- Sharing stories beyond the device (to the class gallery or the teacher's phone). This needs moderation and a separate consent decision.
- Drawing or photo backgrounds, and children drawing their own characters.
- Text in speech bubbles: Grade R–2 children don't read yet, so speech is voice or a picture bubble.
- AI of any kind on stories or voices.

## 3. Scenes and characters

**Scenes** (pictures without words, drawn simply so they're small to download):

| Scene | For stories |
|---|---|
| Bush with a waterhole | 1 Rhino, 8 Tortoise and Hare |
| Garden with flowers | 2 Busy bee, 7 Mouse counts seeds |
| **City street**: tall buildings, a pedestrian crossing, a bus stop | 3 My morning, 6 Say no |
| **Neighbourhood street**: houses, a spaza shop, a bus stop, a soccer field | 3 My morning, 4 The lost ball |
| Classroom | 5 Robot tidies up, 6 Say no |
| Rural village: huts, a path, cattle | Make your own (and other versions of 3 and 4) |

"My morning" (story 3) can be set in **city, neighbourhood or village**: the teacher or parent picks, or the child does.

**Characters:**
- Rhino, Bird, Bee, Girl, Boy, Dog, Mouse, Robot, Stranger (a plain grown-up figure, no costume), Teacher, Tortoise, Hare.
- Props: flowers, ball, bin, litter, seeds, a waterhole.
- The Girl and Boy have no names, so children don't add their own details.
- They show a range of skin tones and hair, chosen by the child.

## 4. The eight stories

| # | Story | Characters (default voice) | What the child codes | Links |
|---|---|---|---|---|
| 1 | Rhino finds the water | Rhino (Giant), Bird (Mouse) | Rhino walks to the waterhole; Bird flies over and says "this way!" | Rhino lessons; caring for animals; C.1, C.3 |
| 2 | Busy bee | Bee (Bee), three flowers | Bee visits each flower in turn, then flies home | Plants need bees; counting 1–3; C.1, C.2 |
| 3 | My morning | Girl or Boy (Girl / Boy) | Wake up, wash, eat, walk to the bus stop, wave goodbye | Daily routines; first, next, last; C.1 |
| 4 | The lost ball | Boy, Dog (Mouse), Girl | Ball rolls away; Dog finds it; the children say "thank you" | Asking for help, sharing; C.1, C.3 |
| 5 | Robot tidies the classroom | Robot (Robot), Girl | Robot picks up litter and takes it to the bin; Girl cheers | What robots do for people; R.1, R.2 |
| 6 | Say no, tell a grown-up | Boy, Stranger (Robot), Teacher | Stranger asks for the boy's name and where he lives; Boy says "No!" and walks to the Teacher | Keeping personal information safe; D-codes |
| 7 | Mouse counts seeds | Mouse (Mouse) | Mouse collects 5 seeds one by one, counting, then takes them home | Counting; repeat (×5); C.1, C.6 |
| 8 | Tortoise and Hare | Tortoise (Giant), Hare (Mouse) | Hare zooms ahead and naps; Tortoise keeps going and wins | Public-domain fable retold in our own words; keep trying; C.1 |

- Each story is data, like missions: `content/junior/stories/<id>.json`, with its scene, characters, picture strip, CAPS codes, grades and term.
- **The wording of story 6** (strangers) is reviewed by a teacher before publishing.
- Folktales are used only if public domain, retold in our own words.

## 5. Voices and privacy (POPIA)

**How recording works**
1. The child taps the 🎤 card on a character.
2. The microphone switches on for up to 5 seconds, then off.
3. The child picks a voice picture and hears the line in that voice.
4. ✓ keeps the **filtered** sound. The natural recording is never written to storage: it exists only in memory while the child chooses, then is discarded.

**Six voices** (Web Audio built into the browser, no extra download; each has a picture):

| Voice | Sounds like |
|---|---|
| 🦏 Giant | slow and deep |
| 🐭 Mouse | fast and squeaky |
| 🤖 Robot | metallic |
| 🐝 Bee | buzzy, wobbly |
| 👦 Boy | a **cartoon** boy's voice |
| 👧 Girl | a **cartoon** girl's voice |

- Boy and Girl are pitch-shifted and smoothed so they hide a child's voice as well as Robot does. They never sound like the child.
- A voice can be used by only one character in a story, so it's clear who is speaking.
- To change a voice, the child records again: the original is gone.

**Rules**
- **Children always get a filter.** There's no natural-voice option for anyone under 18.
- **Adults** (teachers and parents, signed in) can turn natural voice on or off for their own narration. They consent for themselves.
- Sounds are stored **on the device only**. They are never uploaded, never sent to AI and never used to identify anyone. They're deleted with the story, and when a learner signs out of a shared device.
- **Consent:** one line is added to the parent consent at account setup (M5), covering filtered voices kept on the device. There's no separate switch. **A lawyer confirms the wording** (owner action).
- Children who aren't signed in (free play) can't record. They use the ready-made sounds only, because a parent's consent is needed first.

## 6. Users and journeys

- **Teacher sets stories:** on the class page, the teacher ticks stories (for example 3 "My morning" with the neighbourhood scene, and 6 "Say no"). The learners see them first, marked with a star, under "Set for you".
- **Parent sets stories:** same, from the family view, for their own child.
- **Learner retells:** opens "My morning", sees four pictures (wake up, wash, eat, bus stop), gives the Girl cards for each step, taps ▶, and the story plays. If it matches the strip, they get stars.
- **Learner makes their own:** picks the city scene, adds Robot and Dog, records the Dog saying "woof" in the Mouse voice, plays it to the class on the big screen.
- **Offline:** everything works after the first visit, including recording, which needs no internet.

## 7. Requirements

| ID | Requirement |
|---|---|
| S-1 | A **Stories** section in Junior: a scene, up to 4 characters, a card row per character, ▶ plays every character's row at the same time. |
| S-2 | Cards: move (4 directions, or forward and turn as in the grade's mode), jump, grow/shrink, hide/show, wait, play sound, **speak** (🎤 recorded line or a ready-made sound), repeat number under the card, ▶ start. No text. |
| S-3 | **Retell:** a 3–4 picture strip. The story checks the order of what happens against the strip (who moves where, who speaks), with stars as in grid mode. |
| S-4 | **Make your own:** any scene and characters; saved on the device (named by a picture, not text); up to 10 stories per learner on a device. |
| S-5 | **Sets:** a teacher sets stories (and a scene for story 3) for a class; a parent for their child. They show first under "Set for you". Stored with the class or family records (M5), not with the child. |
| S-6 | **Voices:** as §5. The 5-second limit is enforced, the microphone is released as soon as recording stops, and only the filtered sound is stored. |
| S-7 | **Data:** stories, scenes and characters are content files checked at build (CAPS codes, grades, term, strip). Recorded sounds stay in the browser's storage on that device only. |
| S-8 | **Big screen**, offline, 360 px phone, WCAG 2.2 AA (every card and character has a spoken name), interface words through i18n. |
| S-9 | **Size:** scenes and characters are simple SVG. The Stories section adds under 60 KB compressed, excluding sounds. |

## 8. Threat notes

| Threat | Mitigation |
|---|---|
| A child's natural voice stored or leaked | Filtered before storage; no natural voice for children; never uploaded; no AI; deleted on sign-out of a shared device |
| The microphone left on | On only for the 5-second recording, released straight after; the browser's microphone indicator shows |
| A child says personal details in a recording | It stays on the device, and the filter disguises the voice; story 6 teaches not to; no sharing in this version |
| A stranger story upsets a child | Teacher review of the wording; calm, everyday pictures; ends with the child safe with the Teacher |
| Sets reveal something about a child | Sets are stored on the class or family, not the child; they list story ids only |

## 9. Acceptance criteria

- [ ] All 8 stories play in Retell; a correct retelling gets stars, a wrong order says "try again" (e2e, 360 px).
- [ ] Make your own: add characters, cards, play, save, reopen offline (e2e).
- [ ] A teacher's set shows first for the class's learners; a parent's for their child (e2e).
- [ ] Recording: microphone on for at most 5 s; only the filtered sound in storage; no natural-voice option for a learner; an adult can switch natural voice on (unit tests with a fake microphone, e2e).
- [ ] Sounds are deleted when the learner signs out of a shared device (e2e).
- [ ] Size budget (CI); accessibility check on the Stories pages.
- [ ] People checks in the test plan: story pictures and wording reviewed (story 6 by a teacher); voices on a real low-end phone (do Boy and Girl hide the child's voice?); the consent wording (lawyer).

## 10. Work plan

Spec approved by the owner (2026-11-28). Then:

1. **Scenes and characters:** the content format for stories, the 6 scenes and 12 characters as SVG, and the card row per character with ▶ (S-1, S-2, S-7).
2. **Retell and the eight stories:** picture strips, checking, stars (S-3).
3. **Make your own:** saving on the device (S-4).
4. **Voices:** recording, the six filters, storage and deletion rules, the adult switch, the consent line (S-6). ⏸ The lawyer checks the consent wording before this goes live.
5. **Sets:** teacher and parent setting stories (S-5).
6. **Big screen, offline, size and accessibility** pass (S-8, S-9). ⏸ Owner review.

**If Claude Code already has stories work** (the owner mentioned some on 2026-11-28), it pushes it as a draft PR first, and the plan adapts to it.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-28 | First draft from the owner's brainstorm: Retell and Make your own, 8 stories, teacher and parent sets, city and neighbourhood scenes, six cartoon voices filtered on the device |
| 0.2 | 2026-11-28 | Approved by the owner; CAPS codes per `docs/caps-foundation-codes.md` |
