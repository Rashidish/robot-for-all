# MicroPython firmware for the BBC micro:bit

Served from our own domain (zero-rating rule) and downloaded only when a learner taps
**Download .hex** or **Send to micro:bit** (M3 spec §5).

| File | Board | Version | Source | Licence |
|---|---|---|---|---|
| `microbit-v1-micropython-1.1.1.hex` | micro:bit V1 | 1.1.1 | https://github.com/bbcmicrobit/micropython/releases/tag/v1.1.1 | MIT |
| `microbit-v2-micropython-2.1.2.hex` | micro:bit V2 | 2.1.2 | https://github.com/microbit-foundation/micropython-microbit-v2/releases/tag/v2.1.2 | MIT |

Copied unchanged from the micro:bit Python Editor (`microbit-foundation/python-editor-v3`,
`src/micropython/`, MIT). The version is part of each file name, so devices that saved an older copy offline fetch the new one.
To update: copy the newer files from there with the new version in the name, update
`apps/web/src/code/hex.ts` and this table.
