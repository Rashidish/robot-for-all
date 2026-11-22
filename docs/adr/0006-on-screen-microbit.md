# ADR-0006: On-screen micro:bit runs real MicroPython

- **Status:** Accepted (owner asked for full MakeCode-level functionality, 2026-11-22)
- **Date:** 2026-11-22
- **Decider:** Rashid Ishmail

## Context
The M3 spec planned our own small interpreter for the virtual micro:bit. The owner then asked for
everything MakeCode can do, typed Python, and extensions such as RGB LEDs. A hand-written
interpreter would have to re-implement MicroPython (music, radio, images, sound, typed code) and
would never match a real board exactly.

## Options considered
| Option | Size | Offline | Licence | Fidelity | Notes |
|---|---|---|---|---|---|
| A. Our interpreter (step 2) | Tiny | Yes | Ours | Only our blocks | Can't run typed Python |
| B. Embed python-simulator.usermbit.org | 0 for us | No | MIT | Real MicroPython V2 | Third-party domain: breaks zero-rating and our CSP |
| C. Build the micro:bit Foundation's simulator from source and serve it ourselves | About 1–2 MB, loaded only on `/code/`, then cached | Yes | MIT | Real MicroPython V2 | Needs Emscripten in CI (cached); small patches |

## Decision
Option C. CI builds `microbit-foundation/micropython-microbit-v2-simulator` at the version in
`apps/web/simulator.version`, applies `patches/simulator/*.patch`, makes it fit our strict CSP
(`scripts/vendor-simulator.mjs`), and serves it from `/simulator/<version>/` in a same-origin iframe.

## Our patches
1. **No service worker code**: upstream registers, or *unregisters*, a worker for its scope, which
   would remove our site's worker. Our worker caches the simulator instead.
2. **Report pin outputs and NeoPixel data** to the editor (upstream ignores them), so learners see
   the motor direction, pin states and RGB LED strips like in MakeCode. These patches are small
   and could be offered upstream.

## Security
`/simulator/*` keeps the site's policy with two changes only: `'wasm-unsafe-eval'` (compiles
WebAssembly; JavaScript `eval` stays blocked) and `frame-ancestors 'self'` with
`X-Frame-Options: SAMEORIGIN` (only our pages can show it). Inline styles in its page and board
drawing are moved to files or converted at build time; a unit test pins the policy.

## Consequences
- Blocks and typed Python run on exactly the MicroPython that runs on a micro:bit V2.
- The step 2 interpreter stays for tests and may drive the 2D robot simulator (M4).
- Watch: upstream calls the embedding API "not yet stable"; we pin a version and test it in CI.
