# ADR-0005: Block editor and micro:bit toolchain

- **Status:** Proposed (spike in progress, M3 step 1)
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
| C. Own editor: Blockly + MicroPython, micro:bit Foundation libraries | To measure (spike); target ≤ 450 KB compressed for `/code/` | Yes | Apache-2.0 (Blockly), MIT (microbit-fs, microbit-connection, MicroPython) | Free | We write blocks, generator and a small interpreter; fits lessons, i18n and our CSP |

## Decision
Option C (proposed): Blockly for blocks, MicroPython as the code learners see and send, the
micro:bit Educational Foundation's `microbit-fs` to build the .hex and `microbit-connection` for
WebUSB, with the MicroPython firmware served from our own domain.

## Why (spike evidence — to fill in from CI)
- `/code/` compressed size: _TBD_
- Lighthouse mobile on `/code/`: performance _TBD_, accessibility _TBD_
- CSP: Blockly adds two generated `<style>` elements (common and renderer CSS). They are
  allowed on `/code/*` only, by exact SHA-256 hash; no `unsafe-inline`. An e2e test fails with
  the new hashes if Blockly's CSS ever changes.
- Firmware: V1 1.1.1 (636 KB, 251 KB gzip) and V2 2.1.2 (1.24 MB, 500 KB gzip), fetched only
  on Download/Send, then cached offline.
- WebUSB: allowed on `/code/*` only (`Permissions-Policy: usb=(self)`); everywhere else stays `usb=()`.

## Consequences
- Easier: one lesson flow, our i18n, small pages, no third-party domain, Python view for PRIMM.
- Harder: we maintain the block set, the MicroPython generator and the interpreter (tested in CI).
- Watch: Blockly upgrades (CSS hashes), `microbit-connection` updates, iPhone (no WebUSB: Download
  .hex only), block editors' limits for blind learners (Python view as text alternative).
- CLAUDE.md §5 "micro:bit" row changes from MakeCode to this choice once accepted.
