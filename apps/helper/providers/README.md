# AI provider checklist (ADR-0018, M6 spec FR-25)

A model may be added to the allowed list (`apps/helper/src/providers/models.ts`) only with an entry
here, filled in by pull request and checked with the Information Officer. A provider that keeps or
trains on what people type is never used for children (`forChildren: false`).

| Question | What to record |
|---|---|
| Are inputs used to train models? | Yes or no, with the clause of the terms |
| How long are inputs kept, and why? | Days; any exceptions (e.g. abuse checks) |
| Where is the processing? | Countries; POPIA s72 note |
| Price | Input, cache and output per million tokens; free-tier limits |
| Safety test set | `npm run helper-safety -- <model>`: passed / total, date, prompt versions |
| Use with children | Do the terms allow services used by children? |
| Licence (open models) | Licence name and anything it forbids |

## Claude API (Anthropic): `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`

| Question | Answer |
|---|---|
| Inputs used to train models? | *To confirm from Anthropic's commercial terms (owner action, M6 spec §13)* |
| How long kept | *To confirm* |
| Where | *To confirm*; inputs are stripped of personal information first (spec §7.1) |
| Price | Haiku 5.5 $0.10 / $0.50; Sonnet 5.5 $2 / $10; Opus 5.5 $4 / $20 per million tokens (input / output) |
| Safety test set | `claude-haiku-5-5`: **59/59 passed**, 2026-11-27, prompts `adult-v1` and `child-v1` (run by the owner). Sonnet 5.5 and Opus 5.5: not run yet |
| Use with children | *To confirm* |
| Licence | Commercial API |

Until the rows marked *to confirm* are filled in, the helper stays switched off.
