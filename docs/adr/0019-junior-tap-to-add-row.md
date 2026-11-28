# ADR-0019: Junior programs as a tap-to-add row, on their own page

- **Status:** Accepted (owner, 2026-11-27)
- **Date:** 2026-11-27
- **Decider:** Rashid Ishmail

## Context
Junior (spec `docs/specs/junior.md`) lets Grade R–2 learners (about 5 to 8 years old) drive a robot on a grid with picture blocks. The spec's plan was a small sideways Blockly block set, with "a tiny custom row editor of about 300 lines" as the fallback if sideways Blockly didn't work on phones. CLAUDE.md non-negotiables in play:
- cheap phones and touch (§2.1);
- low data (§2.2), and the spec's limit of 40 KB extra for Junior;
- offline (§2.3);
- accessible (§2.7).

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. **Tap-to-add row**: tap a picture to add it to the row, tap a block in the row to take it out | Junior page 34.6 KB compressed in all (its own code about 8 KB) | Yes | Ours (MIT) | About 400 lines | No dragging; every block is a 48 px+ button, so keyboard and screen readers work with no extra code |
| B. Blockly turned sideways | About 256 KB more; slower to start on low-end Android | Yes | Apache-2.0 | Custom renderer and layout | Same drag-and-snap as Grade 3+; dragging small blocks is hard at age 5; over the 40 KB limit |

## Decision
**A**, with **B as the fallback** if people checks show children need drag-and-snap (owner, 2026-11-27).

Two further choices go with it:
- **Its own page**, `/code/junior/`, linked from the code editor's tab row as "Junior", so a young learner's phone doesn't download the Grade 3+ editor.
- **"×N" repeats the next block**: `[×3][↑]` is forward three times. That is one rule, easy to show with arrow cards. Groups of blocks are left out at launch.

## Why
- **Fits the age:** tapping big buttons is within reach of Grade R hands; dragging small blocks onto notches isn't.
- **Within budget:** the whole Junior page is 34.6 KB compressed, under the spec's 40 KB.
- **No Blockly:** Junior uses neither Blockly's 256 KB nor a custom renderer that a Blockly update could break.
- **Same engine for both:** the grid engine (`packages/sim/src/junior.ts`) is pure TypeScript and shared by the page, the build check and the robot-call translation for the real cart (FR-5). Program semantics don't depend on the editor, so switching to B later would keep missions, stars and lessons.

## Consequences
- **Easier:** small download; works by keyboard and screen reader; missions are data checked at build time (each must be solvable in its "best").
- **Harder:**
  - No reordering by drag; a child takes a block out and adds it again (Undo and Clear help).
  - No groups or branches.
  - Children learn drag-and-snap only from Grade 3.
- **Watch:** the people checks in the test plan (Grade R–2 children on cheap phones and a projector). If they can't manage the row, build B.
