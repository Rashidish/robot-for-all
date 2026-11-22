# ADR-0005: Block editor and micro:bit toolchain

- **Status:** Accepted (M3 step 1 spike, PR #26)
- **Date:** 2026-11-22
- **Decider:** Rashid Ishmail

## Context
M3 (spec `docs/specs/M3-code.md`) needs a block editor and a way to run programs on a BBC micro:bit.
Non-negotiables that apply: cheap phones at 360 px (§2.1), everything from our own domain (§2.2),
offline after first use (§2.3), i18n (§2.4), WCAG 2.2 AA (§2.7), permissive licences (§2.8),
and our strict Content-Security-Policy (no inline code, no `unsafe-eval`).

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. Embed MakeCode (hosted) | Several MB, heavy on low-end phones | Partly | MIT | Free | Loads from makecode.org: a third-party domain, breaks zero-rating; own UI, can't follow our lessons or i18n |
| B. Self-host MakeCode | Several MB | Yes | MIT | Free, but a large build to maintain | Still its own app and UI; hard to keep current |
| C. Own editor: Blockly + MicroPython, micro:bit Foundation libraries | 245 KB gzip for `/code/` (spike), budget 450 KB | Yes | Apache-2.0 (Blockly), MIT (microbit-fs, microbit-connection, MicroPython) | Free | We write blocks, generator and a small interpreter; fits lessons, i18n and our CSP |

## Decision
Option C: Blockly for blocks, MicroPython as the code learners see and send, the
micro:bit Educational Foundation's `microbit-fs` to build the .hex and `microbit-connection` for
WebUSB, with the MicroPython firmware served from our own domain.

## Why (spike evidence, CI on PR #26)
- `/code/` first load: **245 KB gzip** (195 KB brotli), of which Blockly is most; budget 450 KB.
  The editor is a separate file, left out of the install download and cached the first time
  a learner opens `/code/`. Other pages are unchanged (home 3 KB, lesson 7 KB).
- Lighthouse mobile on `/code/` (3 runs): performance **83–96**, accessibility **91**. Loading the
  editor straight away scored 77, so the page now shows its text first and loads the editor when
  the browser is idle. Accessibility must be raised in step 3 (keyboard navigation plugin, labels).
- Astro islands add an inline script and style that our CSP blocks, so the editor is started from
  a bundled module script instead (ADR-0001 still holds: Svelte for interactive parts).
- CSP: Blockly adds two generated `<style>` elements (common and zelos renderer CSS). They are
  allowed on `/code/*` only, by exact SHA-256 hash; no `unsafe-inline`. No other CSP violations. An e2e test fails with
  the new hashes if Blockly's CSS ever changes.
- Firmware: V1 1.1.1 (636 KB, 251 KB gzip) and V2 2.1.2 (1.24 MB, 500 KB gzip), fetched only
  on Download/Send, then cached offline.
- WebUSB: allowed on `/code/*` only (`Permissions-Policy: usb=(self)`); everywhere else stays `usb=()`.
- Versions: Blockly 13.5.0, microbit-fs 0.11.0, microbit-connection 1.0.3 (stable, pinned exactly).
- A universal .hex is built in the browser and read back in unit and browser tests; offline
  download works after first use.

## Consequences
- Easier: one lesson flow, our i18n, small pages, no third-party domain, Python view for PRIMM.
- Harder: we maintain the block set, the MicroPython generator and the interpreter (tested in CI).
- Watch: Blockly upgrades (CSS hashes), `microbit-connection` updates, iPhone (no WebUSB: Download
  .hex only), block editors' limits for blind learners (Python view as text alternative).
- CLAUDE.md §5 "micro:bit" row changes from MakeCode to this choice once accepted.
