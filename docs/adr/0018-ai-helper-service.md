# ADR-0018: The AI helper service

- **Status:** Accepted (owner, 2026-11-27)
- **Date:** 2026-11-27
- **Decider:** Rashid Ishmail

## Context
M6 (spec `docs/specs/M6-ai-helper.md` v0.2) adds an AI helper for adults and, with a parent's consent, for children on lesson pages. CLAUDE.md rules that apply:
- AI keys never reach the browser, and AI calls go through our own server (§5, §10);
- no personal data reaches the AI (§7);
- pages stay low-data and zero-rated (§2.1 and §2.2);
- child safety (§2.5, §8);
- free at the core (§2.6).

The owner wants to start with Claude Haiku 5.5 and keep the door open to other providers, including free models, to manage cost (2026-11-27).

## Options considered
| Option | Size / speed | Offline | Licence | Cost | Notes |
|---|---|---|---|---|---|
| A. Calls from the browser to a provider | Small | No | — | Low | Rejected: the key would be in the page; a third-party domain breaks zero-rating |
| B. **A helper Worker on `/helper/` with one adapter per provider and an allowed list** | Small Worker; answers in seconds | Common questions offline | Our code MIT; `@anthropic-ai/sdk` MIT | From about R0.02 a question (Haiku 5.5) | Keys only in Worker secrets; same origin; model per audience as a setting |
| C. The same Worker with one provider only (Claude) | As B | As B | As B | As B | Simpler, but changing provider would mean code changes; the owner asked for choice |
| D. Run an open model ourselves | Needs GPUs | — | Varies | Fixed monthly cost, far above B at our volume | Not now; a free open model can still be used through a provider adapter if it passes the checklist |

## Decision
**B:** a Cloudflare Worker, `apps/helper`, on `robotsforall.org.za/helper/*`. It is the only place that holds AI provider keys. It talks to providers through small adapters and starts with Claude Haiku 5.5 (`claude-haiku-5-5`) through the Claude API. Any other provider or model is used only once it is on an allowed list, with a filled-in provider checklist.

## How
- **Who:** adults with an M5 account session; children with a learner session (ADR-0013), on lesson pages only. A child is allowed only with parent consent control (e) and no class switch off. The database checks all of this in one function, `helper_take`, together with the caps and the monthly budget (migration 0028).
- **What is sent:** a frozen system prompt, chosen by audience; the lesson's own text, or the program's blocks and run report; then the question with personal data stripped. For children, the grade band is sent as well. No ids, names, school names or account details are sent. The system prompt and lesson go first and are marked for prompt caching.
- **What is kept:** no question or answer text. We keep only counts per person per day for 31 days, and totals without ids.
- **Checks on the way out:** every answer is checked for unsafe advice, links and length. A hit replaces the answer with a safe message.
- **Common questions:** drafted by the daily job from the lesson text, with the children's rules. They pass the same automatic check, are stored in the database and are shown with the AI disclaimer. There is no human review (owner decision; CLAUDE.md §8 amended for these only). An answer with three 👎 is hidden and drafted again.
- **The provider checklist** (`apps/helper/providers/README.md`), one entry per provider and model:
  - whether inputs are used for training;
  - how long inputs are kept;
  - where processing happens (POPIA s72);
  - price;
  - the result of the safety test set in English and isiZulu;
  - whether the terms allow use with children.
  
  A provider that keeps or trains on inputs is never used for children.
- **The safety test set:** about 60 prompts with what a safe answer must and must not contain. It runs faked in CI. A script runs it live before a model joins the allowed list and after any prompt change.
- **Switches:** site switch `ai_helper`, a children switch and a kill switch, all in back office settings and effective within a minute.

## Why
- The key stays on our server, and calls stay on our domain, so they remain zero-rated.
- One Worker follows the pattern of `apps/cert` and `apps/signin`, which already handle sessions, rate limits and secrets.
- Adapters let the owner move between models and providers as prices change, without exposing children to providers that keep their words.

## Consequences
- **Easier:**
  - adding a provider means writing an adapter and filling in a checklist;
  - cost is visible and capped;
  - nothing personal is stored.
- **Harder:**
  - each provider's terms must be checked and re-checked;
  - answers in home languages are not reviewed by people;
  - Common questions go out without review, so the automatic checks and the 👎 hiding carry the weight.
- **Watch:**
  - refusal and block counts per prompt version;
  - 👎 per lesson;
  - spend against the budget;
  - any change to a provider's data terms.
