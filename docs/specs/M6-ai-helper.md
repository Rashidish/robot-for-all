# Spec: M6 — AI helper for teachers, coaches and parents

> **Version:** 0.1 (draft) · **Date:** 2026-11-25 · **Owner:** Rashid Ishmail · **Status:** Draft, for review (owner decisions in §13)
> Builds on: CLAUDE.md §2 (low data, free core), §7 (no personal data to AI), §8 (AI rules); M5 (adult accounts, `/db/`, site switches); back-office spec ("AI → Helper settings"); ADR-0017 (same-origin services).

## 1. Purpose

Adults who run the lessons are often not engineers. A teacher with 40 learners and one crank that won't turn, or a parent whose micro:bit robot only spins, needs a quick, safe answer from someone who knows *this* lesson. The helper gives that answer, grounded in our reviewed lesson text, so it stays on topic and matches what the learners have in front of them.

CLAUDE.md §8 sets the rules: it advises and troubleshoots; it does not make public content; it is child-safe; it has cost caps, cached answers and a fallback when the cap is reached or the phone is offline.

## 2. Scope

**In:**
- an **Ask the helper** panel on lesson pages, the code editor and the robot world, for signed-in adults;
- grounding in the lesson (body, parts, safety notes, teacher notes), and on request the program on screen and its last run report;
- **Common questions**: short answers per lesson, drafted by AI in the back office, reviewed by a person, shipped with the lesson and available offline without calling the AI;
- personal data stripped before the call; nothing personal stored;
- per-person daily caps, an overall monthly budget, a site switch;
- back office **AI → Helper settings** and usage counts.

**Out (later):**
- learners (children) asking the helper themselves;
- conversations that last across days, or chat history;
- photos (e.g. "why won't this work?" with a picture of the build);
- voice;
- the back-office generation pipeline (CLAUDE.md §3 back office; its own spec).

## 3. Users and journeys

**Teacher or coach, in class**
1. On the lesson page they tap **Ask the helper**. The panel first shows the lesson's **Common questions** (offline too).
2. Not there? They type the question, for example "the jaw won't close, the straw keeps slipping". A line under the box says: *Don't type learners' names or contact details.*
3. The answer arrives in a few seconds: short steps, the lesson's own words for parts, a safety note where one applies. It is marked *Written by AI. Check it before acting on it.*
4. They tap 👍 or 👎. Only the count is kept.
5. They can ask one follow-up in the same panel; closing the panel forgets the conversation.

**Parent at home (code editor or robot world)**
1. In the editor, they tap **Ask the helper** → **Explain this program** or **Why doesn't it work?**
2. The program on screen (its blocks as JSON, never anything typed into a name field) and, in the robot world, the last run report go with the question.
3. The answer explains in plain words, pointing to blocks by their names on screen.

**When the helper can't answer**
- *Offline:* "You're offline. Here are this lesson's common questions." Nothing is queued.
- *Daily limit reached:* "You've used today's questions. They come back tomorrow." Common questions still work.
- *Budget reached or switch off:* "The helper is resting." Common questions still work.
- *Unsafe or off-topic request:* a short, kind refusal and the safe alternative (e.g. "use the battery pack in the parts list; never mains").

**Content editor (back office)**
1. In a lesson's review screen, **Draft common questions** asks the AI for 5–8 likely questions with answers from the lesson text.
2. They edit, then send for review; a reviewer approves with the checklist (accurate, safe, matches the lesson, plain words). Published by pull request with the lesson, as for other content.

## 4. Functional requirements

### 4.1 Asking
| ID | Requirement |
|---|---|
| FR-1 | The helper answers **signed-in adults only** (teachers, coaches, parents, guardians, personal learners 18+), through their M5 account. Learner sessions and signed-out visitors see Common questions only. |
| FR-2 | Questions are about a lesson, a program or a robot world run; the panel always sends the lesson id (or world id) it was opened from. |
| FR-3 | Up to **500 characters** a question; one follow-up per panel (two questions in a conversation); the conversation lives only in the open panel. |
| FR-4 | Answers are short (aim under 150 words), in steps where useful, use the lesson's part names, and end with a safety note when tools, batteries or heat are involved. |
| FR-5 | Every answer is labelled *Written by AI*; 👍/👎 records only a count per lesson. |
| FR-6 | The answer is in the person's site language where the site has that language (owner decision 5); otherwise English. |

### 4.2 Grounding
| ID | Requirement |
|---|---|
| FR-7 | The helper service reads the lesson from **our own built site** (a JSON file per lesson made at build time: body, parts, substitutes, safety notes, teacher notes, outcomes, concepts). Only **published** lessons, or drafts while `SHOW_DRAFTS` is on in that environment. |
| FR-8 | "Explain this program" and "Why doesn't it work?" send the program JSON (blocks only; the program's name is dropped) and, in the robot world, the run report (ADR-0007), both capped in size. |
| FR-9 | The helper is told to say "I'm not sure" rather than guess, and to point to the lesson section when the lesson answers it. |

### 4.3 Common questions (cached answers)
| ID | Requirement |
|---|---|
| FR-10 | Each lesson may have `faq` entries (question, answer) in its folder, words through i18n like the rest of the lesson. They are content: drafted, reviewed, published like lessons (`status`, `ai_generated`, `reviewed_by`). |
| FR-11 | Published common questions ship with the lesson page and work offline (precached with the lesson). |
| FR-12 | The back office can draft them with AI (5–8 per lesson) from the lesson text only; they always go to review (CLAUDE.md §8). |

### 4.4 Caps and budget
| ID | Requirement |
|---|---|
| FR-13 | **Per person per day:** at most N questions (owner decision 3; proposed 20), counted in the database; resets at midnight South African time. |
| FR-14 | **Overall:** a monthly budget in rand (proposed R1,000); the service stops calling the AI when the month's estimated spend reaches it, and the back office is emailed at 80% and 100% (counts only). |
| FR-15 | A per-IP rate limit at the service (e.g. 10 a minute) stops floods before they reach the database. |
| FR-16 | A site switch **`ai_helper`** (off until the owner opens it), and a kill switch in the back office that takes effect within a minute. |

### 4.5 Back office: AI → Helper settings
| ID | Requirement |
|---|---|
| FR-17 | Settings: on/off, daily cap per person, monthly budget, model (from an allowed list), the **system prompt version** in use. |
| FR-18 | The system prompt is a file in the repo (`apps/helper/prompts/system-vN.md`), changed by pull request and reviewed like content; the settings pick a version. |
| FR-19 | Usage: questions per day, estimated spend, refusals, 👍/👎 per lesson, cap-reached counts. **No question or answer text, no user ids** on this screen. |

## 5. Non-functional requirements
- **Low data:** the panel's code loads only when tapped (no cost on lesson pages that don't use it; under 10 KB compressed). A question and its answer are a few KB. No third-party script: the call goes to `/helper/` on our domain, so it stays zero-rated.
- **Speed:** answer within 10 seconds on 3G for typical questions; a "thinking…" state; one automatic retry on a network error.
- **Offline:** Common questions offline; the Ask box says it needs a connection.
- **Accessible:** the panel is a dialog with focus management; the answer is announced politely (`aria-live`); 44 px targets; works at 360 px.
- **i18n:** every panel string through Paraglide; AI answers are not translated by us (owner decision 5).
- **Cost:** see §11; every call logs tokens and estimated rand cost (no text).

## 6. Technical architecture

```
phone ──POST /helper/ask──▶ helper Worker (apps/helper, robotsforall.org.za/helper/*)
                              │ 1. checks the adult's Supabase session (as the cert service)
                              │ 2. rate limit (binding) → caps and budget (database function)
                              │ 3. strips personal data from the question
                              │ 4. reads /lessons/<id>.json from our own site (cached)
                              │ 5. calls the Claude API (key only here) with prompt caching
                              │ 6. safety check on the answer → records counts and cost
                              ◀── answer (no-store)
```

- **New Worker `apps/helper`** on `/helper/*` (same pattern as `apps/cert` and `apps/signin`, ADR-0017's same-origin rule). It is the **only** holder of `ANTHROPIC_API_KEY` (a Worker secret). Logs off.
- **Claude API** through the official TypeScript SDK (`@anthropic-ai/sdk`, MIT; runs in Workers; bundle size to be checked in the PR). The model is an owner decision (§13, decision 1); the model id is a setting so it can change without code.
- **Prompt caching:** the frozen system prompt and the lesson text come first, marked for caching, so repeated questions about the same lesson pay about a tenth for that part; the question comes last.
- **Refusals:** the API can stop with `stop_reason: "refusal"`; the service shows the kind refusal message and counts it.
- **Answer check:** before sending, the service checks the answer against a short list of things we never advise (mains or wall plugs, coin or button cells, opening or charging lithium cells, cutting without an adult). A hit replaces the answer with a safe message and counts it, for review of the prompt.
- **Database (migration 0028):** `helper_usage(user_id, day, questions)` with a function `helper_take(p_user)` that checks the cap and the monthly budget and adds one, atomically; `helper_spend(month, rand_cents)`; `helper_feedback(lesson_id, up, down)`; settings in the site settings table. Usage rows are deleted after 31 days; only daily totals without user ids are kept for the back office.
- **Lesson JSON:** the build writes `/lessons/<id>.json` for each published lesson (words already in the static pages; a few KB each).
- **ADR needed:** ADR-0018 "The AI helper service" (Worker, key, model choice, caching, what is sent, what is kept).

## 7. Security, privacy and child safety

### 7.1 Data
| Data | Why | Kept | POPIA basis |
|---|---|---|---|
| The question and follow-up | To answer it | **Not stored** by us; sent to the Claude API after stripping (owner decision 4) | Legitimate interest of the adult asking; minimal |
| Program JSON, run report | To explain it | Not stored | As above; contains no personal data |
| Count of questions per adult per day | Caps | 31 days | Legitimate interest (fair use, cost control) |
| Tokens, cost, refusals, 👍/👎 | Budget and quality | Totals only, no user id | Not personal data |

- **Stripping before the call (CLAUDE.md §7):** the service removes email addresses, phone numbers, South African ID numbers, URLs with query strings, and anything typed after "my name is"/"learner called"; it also replaces any nickname of a learner the adult can see (from their classes or children, read from the database at the moment) with "the learner". A note under the box asks people not to type names. The prompt asks the AI to ignore any names it still sees.
- **No account details** (email, display name, organisation) are ever sent; the AI sees no user id.
- **Where the AI runs:** the Claude API is outside South Africa. Because what we send is stripped of personal information, POPIA s72 (sending personal information abroad) should not apply; the owner confirms this with the Information Officer and checks the provider's data retention and training terms for API use (owner action 3).

### 7.2 Child safety
- Children do not use the helper (FR-1); learner sessions are refused by the service, not only hidden in the page.
- The system prompt: friendly, plain words; stays on lesson, building, coding, classroom management of the activity; refuses medical, legal, personal or unrelated requests; never advises mains electricity, coin or button cells, lithium battery changes, or sharp tools without an adult; recommends adult help where the lesson's `safety.adult_help` is true.
- The answer check (§6) is a second line; refusals and blocked answers are counted for review.

### 7.3 Threat notes
| Threat | Mitigation |
|---|---|
| Stealing the API key | Only in the helper Worker's secrets; never in a page, the repo or the database |
| Running up the bill (one person, many accounts, scripts) | Sign-in needed (email code); per-person cap; per-IP limit; monthly budget stops calls; kill switch |
| Jailbreaking it into unsafe advice | Frozen system prompt reviewed like content; answer check; refusals counted; questions capped at 500 characters; no tools or web access for the model |
| Prompt injection through content | Only our own reviewed lessons and the adult's own program are sent; the program's free-text fields are dropped |
| Personal data reaching the AI or our logs | Stripping (§7.1); nothing stored; logs off; tests that plant names and emails and check what was sent (as the M5 name-leak test) |
| A child using a parent's phone | The adult's own session; answers are adult-facing but still child-safe in tone and content |
| Wrong but confident answers | "Written by AI" label; "I'm not sure" instruction; grounding in the lesson; 👎 counts per lesson to find weak spots; Common questions reviewed by people |

## 8. Acceptance criteria
- [ ] A signed-in teacher asks about a lesson and gets a grounded answer in under 10 s on a throttled 3G profile; a learner session or a signed-out visitor is refused by the service.
- [ ] Common questions show on the lesson offline, and the Ask box says it needs a connection.
- [ ] The 21st question of the day is refused with the friendly message; the next day it works.
- [ ] When the month's budget is reached, no further API calls are made and the back office is emailed.
- [ ] A question containing a learner's nickname, an email, a phone number and an ID number reaches the (faked) API with none of them; nothing about the question is stored or logged.
- [ ] A request for mains wiring, coin cells or charging lithium cells is refused; a planted unsafe answer from the (faked) API is replaced by the safe message.
- [ ] Repeated questions on one lesson hit the prompt cache (cache-read tokens > 0).
- [ ] Back office Helper settings change the cap and switch the helper off within a minute; the usage screen shows no text and no user ids.
- [ ] Lesson pages that don't open the panel load no helper code; Lighthouse stays 90+.

## 9. Work plan for Claude Code
One PR per step; ⏸ marks a stop for review.
1. ⏸ **This spec**, then **ADR-0018** (the AI helper service) for review.
2. **Database:** migration 0028 (usage, budget, feedback, `helper_take`), PGlite tests.
3. **Lesson JSON** at build time and **Common questions** in the lesson format (`faq`), with build checks and offline precache; back-office review of common questions (drafting by AI comes in step 6).
4. **Helper Worker:** session check, limits, stripping, grounding, the API call (faked in tests), answer check, counts; deploy switch (`HELPER_DEPLOY`), `docs/deploy.md`.
5. **The panel** on lesson pages, editor and robot world (lazy-loaded), offline and limit states, 👍/👎; e2e tests at 360 px.
6. **Back office:** AI → Helper settings and usage; Draft common questions with AI (to review).
7. ⏸ **People checks** (test plan): teachers ask real questions in a class; reviewers rate 30 answers against the lessons; a try at unsafe requests.

## 10. AI opportunities
The helper's 👎 counts and refusals per lesson show where lessons are unclear; the back office can suggest lesson edits from them (drafts to review). Common questions can grow from the most-asked topics (counts only).

## 11. Revenue and cost notes
Core stays free; the helper is free within the daily cap. Estimated cost per question, with about 6,000 tokens of system prompt and lesson (mostly cached), a short question and about 1,000 tokens of thinking and answer (to be measured in step 4):

| Model | Input / output per million tokens | Rough cost per question | 20,000 questions a month |
|---|---|---|---|
| Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | about $0.02 (R0.40) | about R8,000 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | about $0.01 (R0.20) | about R4,000 |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10 / $0.50 | about $0.001 (R0.02) | about R400 |

Prices are the API's list prices today; the rand figures assume about R18 to the dollar. Later paid add-ons this makes possible: a higher cap for school subscriptions; a helper inside the school dashboard.

## 12. Risks
- **Quality on cheaper models:** a cheaper model may give weaker troubleshooting. Mitigation: grounding, Common questions, the people check in step 7, and the model as a setting so it can change.
- **isiZulu and other languages:** AI answers in home languages are not reviewed by people (owner decision 5).
- **Cost spikes** from a school running a big event: per-person cap and monthly budget; the back office can raise the budget for a day.
- **Provider outage:** the panel falls back to Common questions.

## 13. Owner decisions
1. **Model.** Recommendation: **Claude Opus 5.5** for the best troubleshooting quality, with the monthly budget (decision 3) as the guard. Alternatives: Sonnet 5.5 (about half the cost) or Haiku 5.5 (about a twentieth). The model is a setting, so it can change later.
2. **Who can ask:** signed-in adults only (teachers, coaches, parents and guardians, personal learners 18+); children see Common questions only. *(Recommended.)*
3. **Caps:** 20 questions per adult per day; a monthly budget of R1,000 to start, raised by the owner in the back office. *(Proposed numbers.)*
4. **Keeping questions:** **store no question or answer text** (recommended); or keep stripped text for 30 days so reviewers can improve the prompt and Common questions (more useful, more to protect).
5. **Language of answers:** answer in the person's site language with the "Written by AI" label (recommended, since most home-language lessons are still drafts); or English only until translations are reviewed.
6. **Common questions:** drafted by AI in the back office and reviewed like lesson text before they go live. *(Recommended; it also cuts cost, because they need no call.)*

**Owner actions** (when building starts): an Anthropic API account and key (set as a Worker secret, never shared); check the provider's API data-retention and training terms with the Information Officer (§7.1); set the monthly budget; give a reviewer the job of the system prompt.

## Version history
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-25 | First draft |
