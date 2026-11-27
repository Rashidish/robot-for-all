# Spec: M6 — AI helper

> **Version:** 0.3 · **Date:** 2026-11-27 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-27), with ADR-0018
> Builds on: CLAUDE.md §2 (low data, free core), §7 (no personal data to AI), §8 (AI rules, amended here); M5 (adult accounts, learner sign-in, consent controls, class switches, site switches); back-office spec ("AI → Helper settings"); ADR-0013 (learner sessions); ADR-0017 (same-origin services).
> **Owner direction (2026-11-27):** answers are **ring-fenced to STEM education** (science, technology, engineering and mathematics, taught together to build critical thinking, problem-solving, creativity and collaboration), always with safety in mind. Adults ask from **their home page** and lesson pages; **children ask on lesson pages only**, with their use managed. **Common questions are drafted by AI with no human review**, shown with an "AI can be wrong" disclaimer, so they add no back-office work. Start with **Claude Haiku 5.5**; the settings allow **other AI providers**, including free models, to manage cost. Every safeguard proposed is accepted, and any other useful one added.

## 1. Purpose

Learners and the adults around them get stuck: a crank that won't turn, a robot that only spins, a question about why gears change speed. A quick, safe answer keeps them going. The helper gives that answer, kept to STEM education and grounded in our lessons, so it stays on topic and matches what is on the table.

CLAUDE.md §8 sets the frame: it advises and troubleshoots; it is child-safe; it has cost caps, cached answers and a fallback when the cap is reached or the phone is offline.

## 2. Scope

**In:**
- **Adults** (teachers, coaches, parents and guardians, personal learners 18+): **Ask the helper** on their home page (`/account/`) and on lesson pages;
- **children** (signed in with their picture PIN): **Ask the helper** on lesson pages only, when their parent has turned it on and no class has turned it off (§4.2);
- answers ring-fenced to STEM education, with safety first;
- grounding in the lesson (body, parts, safety notes, teacher notes) and, from the code editor and robot world, the program and its last run report;
- **Common questions** per lesson, drafted by AI automatically, checked automatically, shown with a disclaimer, offline after the first visit;
- personal data stripped before every call; no question or answer text stored;
- caps per person, per class and for the whole platform; a site switch and a kill switch;
- more than one AI provider behind one service, each approved by a checklist before use;
- back office **AI → Helper settings** and usage counts.

**Out (later):** chat history across visits; photos or voice; the back-office generation pipeline for lessons (its own spec).

## 3. Users and journeys

**Teacher, coach or parent (home page or lesson page)**
1. On their home page they tap **Ask the helper** (a general STEM question, e.g. "how do I explain gear ratios to Grade 5?"), or on a lesson page (the question goes with that lesson).
2. A line under the box: *Don't type learners' names or contact details.*
3. The answer arrives in a few seconds: short steps, the lesson's part names, a safety note where it applies, labelled *Written by AI. AI can be wrong: check before you act.*
4. 👍 or 👎 (counts only). One follow-up in the same panel; closing it forgets the conversation.

**Child (lesson page only)**
1. Signed in on `/class/`, on a lesson page, they see **Ask the helper** only if their parent turned it on and no class of theirs has turned it off. Otherwise they see the Common questions only.
2. They type up to 200 characters: "why does my crocodile's mouth not close?" The panel says: *Don't type your name or where you live.*
3. The answer is short, friendly, for their grade band, and safe; it ends by suggesting they try it and ask their teacher or parent if it still doesn't work. Labelled *Written by AI. It can be wrong. Ask an adult before using tools.*
4. Five questions a day (setting); then "You've asked your questions for today. Try the Common questions, or ask your teacher."

**Parent: turning it on for a child**
- In **Your children**, each child has a new control: **"Let my child ask the AI helper on lesson pages"** (off by default), with a short notice: what is sent (the question with names removed, the lesson, the grade band), what is kept (nothing but counts), that AI can be wrong. Turning it off takes effect at once.

**Teacher or coach: managing a class**
- In the class view, **"Learners may ask the AI helper"** (on by default once parents allow it). Off for a class means off for its learners while they're in it; for a child in several classes the stricter one wins (as for badge checks). They see a count of questions asked this week, never the text.

**When the helper can't answer**
- *Offline:* the Common questions the phone already has; "Asking needs a connection."
- *Limit reached, budget reached or switched off:* a friendly message; Common questions still work.
- *Off-topic or unsafe:* a short, kind refusal and the safe alternative ("use the battery pack from the parts list; never a wall plug").
- *A child sounds hurt, scared or unsafe:* a calm reply that they should tell a trusted adult (a parent, teacher or coach) and that they can call **Childline on 116** (free), then nothing else. Nothing is stored, so nobody is alerted (§7.3).

**Nobody in the back office** has to do anything for Common questions to appear (§4.4).

## 4. Functional requirements

### 4.1 Who can ask, and where
| ID | Requirement |
|---|---|
| FR-1 | **Adults** with an M5 account (teachers, coaches, parents, guardians, personal learners) can ask from `/account/` and lesson pages. |
| FR-2 | **Children** with a learner session (ADR-0013) can ask on lesson pages only, and only when FR-6 allows. The service checks this itself; hiding the button is not enough. |
| FR-3 | Signed-out visitors see Common questions only. |
| FR-4 | Questions: adults up to 500 characters, children up to 200; one follow-up per panel; the conversation lives only in the open panel. |
| FR-5 | Every answer, and every Common question, carries the AI disclaimer in the reader's language: *Written by AI. AI can be wrong.* plus, for children, *Ask an adult before using tools.* |

### 4.2 Children's use, managed
| ID | Requirement |
|---|---|
| FR-6 | A child may ask only if (a) their parent or guardian turned on the new consent control **(e) AI helper** (off by default; recorded with the notice version and time, M5 FR-7), and (b) none of their classes has **"Learners may ask the AI helper"** off (stricter wins). Family groups follow the parent's control; there is no class switch to add. |
| FR-7 | Children's daily cap (default 5) and a per-class daily cap (default 5 × learners in the class) are back-office settings. |
| FR-8 | Children's answers use a **separate, stricter system prompt**: grade-band wording (3–4, 5–6, 7–9, from the learner's grade; nothing else about them is sent), shorter answers, "try it, then ask your teacher or parent", never asks them anything about themselves, never acts as a friend, refuses anything outside STEM learning with a kind redirect. |
| FR-9 | Three refused questions in a day pause that child's helper until tomorrow (counted, not stored). |

### 4.3 What answers may cover
| ID | Requirement |
|---|---|
| FR-10 | **Ring-fenced to STEM education:** science, technology, engineering and mathematics, and how to teach and learn them (critical thinking, problem-solving, creativity, collaboration), centred on our lessons and projects. Anything else is refused kindly with a pointer back to STEM. |
| FR-11 | **Safety first:** answers never advise mains electricity or wall plugs, coin or button cells, opening, charging or changing lithium cells, heat or chemicals beyond the lesson, or cutting tools without an adult; where the lesson has `safety.adult_help: true` they say an adult must help. |
| FR-12 | Grounding: on a lesson page the lesson's own text goes with the question; from the editor or robot world, the program JSON (blocks only; names and free-text fields dropped) and the last run report, size-capped. On the home page, no lesson. |
| FR-13 | Answers contain **no links** (removed before sending): no sending anyone, least of all a child, off our zero-rated site. |
| FR-14 | Answers say "I'm not sure" rather than guess, and point to the lesson section when the lesson answers it. Answers are in the person's site language where the site has it, otherwise English. |

### 4.4 Common questions (AI-drafted, no human review)
| ID | Requirement |
|---|---|
| FR-15 | For every live lesson, the helper service's daily job drafts **5–8 common questions with answers** per site language, from the lesson text only, with the children's rules (FR-8, FR-10, FR-11). |
| FR-16 | Each answer passes the **automatic safety check** (§6) before it is stored; one that fails is dropped and redrafted next day. |
| FR-17 | They are **not reviewed by a person** (owner decision 6). They show with the AI disclaimer (FR-5) and a 👎 button; an answer with **3 or more 👎** is hidden at once and redrafted. |
| FR-18 | They are served from `/helper/faq/<lesson>` (public, cacheable) and kept offline once the lesson has been opened online. When the lesson's text changes, they are redrafted. |
| FR-19 | They are stored in the database (not in the repository), so they never go through the content pull-request flow. CLAUDE.md §8's review rule still applies to lessons, templates, worlds, badges and everything else. |

### 4.5 Caps and budget
| ID | Requirement |
|---|---|
| FR-20 | **Adults:** 20 questions a day (setting). Three refused questions in a day pause that adult's helper until tomorrow. |
| FR-21 | **Whole platform:** at most **20,000 questions a month** (setting), and a **monthly rand budget** worked out from the chosen model's price (§11); calls stop at whichever comes first. Common questions count against the budget, not the question cap. The back office is emailed at 80% and 100% (counts only). |
| FR-22 | A per-IP rate limit at the service (e.g. 10 a minute; 30 a minute for a school's shared address, setting). |
| FR-23 | Site switch **`ai_helper`** (off until the owner opens it); a separate **children** switch; a kill switch in the back office, effective within a minute. |

### 4.6 AI providers and models
| ID | Requirement |
|---|---|
| FR-24 | The service talks to AI providers through **one small adapter per provider**. It starts with **Claude Haiku 5.5** (`claude-haiku-5-5`) through the Claude API. |
| FR-25 | Other providers and models, **including free ones**, can be added to an **allowed list** by pull request, each with a filled-in **provider checklist**: inputs not used for training; how long inputs are kept; where processing happens (POPIA s72); price; a pass on our **safety test set** (§6) in English and isiZulu; licence and terms that allow use with children. |
| FR-26 | Back-office settings choose the model for **adults**, for **children** and for **Common questions** from the allowed list (they may differ). A provider that keeps or trains on inputs is never allowed for children. |
| FR-27 | If the chosen provider fails, the service tries the next allowed model for that audience once, then falls back to Common questions. |

### 4.7 Back office: AI → Helper settings
| ID | Requirement |
|---|---|
| FR-28 | Settings: switches (FR-23), caps (FR-7, FR-20, FR-21), models per audience (FR-26), the system prompt versions in use. |
| FR-29 | System prompts are files in the repo (`apps/helper/prompts/adult-vN.md`, `child-vN.md`, `faq-vN.md`), changed by pull request and reviewed; the safety test set runs against each new version (faked in CI, live once per change by script). |
| FR-30 | Usage: questions a day by audience, estimated spend, refusals, blocked answers, 👍/👎 and hidden Common questions per lesson, caps reached. **No question or answer text and no user or learner ids** on this screen. |

## 5. Non-functional requirements
- **Low data:** the panel's code loads only when tapped (under 10 KB compressed); Common questions are a few KB per lesson; all calls go to `/helper/` on our domain (zero-rated). No third-party script in any page.
- **Speed:** answers within 10 seconds on 3G for typical questions; a "thinking…" state; one retry on a network error.
- **Offline:** Common questions offline once seen; asking needs a connection.
- **Accessible:** the panel is a dialog with focus management; answers announced politely (`aria-live`); 44 px targets; works at 360 px; readable font size for children.
- **i18n:** every panel string, the disclaimer and the refusal messages through Paraglide.
- **Cost:** every call logs tokens and estimated rand cost (no text).

## 6. Technical architecture

```
phone ──POST /helper/ask──▶ helper Worker (apps/helper, robotsforall.org.za/helper/*)
                              │ 1. who is asking: adult (Supabase session) or child (learner session)
                              │ 2. rate limit → helper_take(): caps, consent, class switches, budget
                              │ 3. strips personal data from the question
                              │ 4. lesson text from /lessons/<id>.json on our own site (cached)
                              │ 5. AI provider adapter (keys only here), prompt caching
                              │ 6. answer check: unsafe advice, links, length → counts and cost
                              ◀── answer (no-store)
      GET /helper/faq/<lesson> ◀── Common questions from the database (cacheable)
      daily job (Cron Trigger): draft, check and store Common questions; budget emails
```

- **New Worker `apps/helper`** on `/helper/*` (same pattern as `apps/cert` and `apps/signin`; ADR-0017). It is the **only** holder of AI provider keys (Worker secrets). Logs off.
- **Provider adapters** (`src/providers/<name>.ts`): one interface (system prompt, cached context, question, limits → answer, tokens, refusal). The Claude adapter uses the official TypeScript SDK (`@anthropic-ai/sdk`, MIT; bundle size checked in the PR); others are added only with the checklist (FR-25).
- **Prompt caching:** the frozen system prompt and the lesson text first, marked for caching; the question last.
- **Answer check** (before any answer or Common question goes out): a list of things we never advise (mains, wall plugs, coin or button cells, opening or charging lithium cells, knives or blades without an adult, fire, chemicals), links removed, length capped. A hit replaces the answer with the safe message and is counted.
- **Safety test set** (`apps/helper/test/safety.json`): about 60 prompts in English and isiZulu (unsafe requests, off-topic, personal questions, attempts to get past the rules, a child sounding unsafe) with what a safe answer must and must not contain. CI runs it against a faked provider to test the plumbing; a script runs it live against a model before it is allowed (FR-25) and after each prompt change (FR-29).
- **Database (migration 0028):**
  - `helper_usage(subject, day, asked, refused)`: subject is an adult or learner id; deleted after 31 days;
  - `helper_take(...)`: one function that checks the person's cap, children's consent (e) and class switches, the class cap, the platform caps and budget, then counts, atomically;
  - `classes.helper_allowed` (default true) and consent control `ai_helper` in M5's consent table;
  - `helper_month(month, questions, spend_cents)`, `helper_faq(lesson_id, language, items, model, prompt_version, lesson_hash, made_at)`, `helper_faq_votes(lesson_id, language, item, down)`;
  - daily totals for the back office, without ids.
- **Lesson JSON:** the build writes `/lessons/<id>.json` for each live lesson (the words already on its page).
- **ADR-0018** "The AI helper service": the Worker, provider adapters and the allowed list, what is sent and kept, children's access, Common questions without review.

## 7. Security, privacy and child safety

### 7.1 Data
| Data | Why | Kept | POPIA basis |
|---|---|---|---|
| An adult's question and follow-up | To answer it | **Not stored**; sent to the AI provider after stripping | Legitimate interest of the adult asking |
| A child's question and follow-up | To answer it | **Not stored**; sent after stripping | **Parent's consent** (control e; POPIA s35(1)(a)) |
| Grade band (3–4, 5–6, 7–9) | Age-appropriate answers | Not stored | As above |
| Program JSON, run report | To explain it | Not stored | Contains no personal data |
| Questions per person per day, refusals | Caps, pausing | 31 days | Legitimate interest (fair use, safety, cost) |
| Tokens, cost, 👍/👎, blocked answers | Budget and quality | Totals without ids | Not personal data |

- **Stripping before every call (CLAUDE.md §7):** email addresses, phone numbers, South African ID numbers, street addresses that follow "I live", URLs, and anything after "my name is" / "I am called" / "learner called" are removed; the nicknames of learners the adult can see (or the child's own nickname and their classmates', for a child) are replaced with "the learner". The prompt tells the AI to ignore any name it still sees and never to ask for one.
- **Never sent:** account details, user or learner ids, school or club names, the certificate name.
- **Outside South Africa:** the provider processes the stripped question abroad. With personal information stripped, POPIA s72 should not apply; the provider checklist (FR-25) records each provider's terms, and the Information Officer confirms (owner action 3).

### 7.2 Child safety
- Children ask only with a parent's consent (control e), only on lesson pages, only while no class has switched it off, with a small daily cap, and pause after three refused questions.
- A stricter children's prompt (FR-8), no links (FR-13), the answer check and the safety test set; a provider that keeps or trains on inputs is never used for children (FR-26).
- **A child who sounds hurt, scared or in danger** gets a calm answer pointing to a trusted adult and Childline (116, free), then the conversation closes. Because nothing is stored, nobody is alerted; the notice to parents (§3) says so plainly. *(Owner decision 7: whether to go further later.)*
- Common questions are written with the children's rules even though adults read them too.

### 7.3 Threat notes
| Threat | Mitigation |
|---|---|
| Stealing a provider key | Only in the helper Worker's secrets; never in a page, the repo or the database |
| Running up the bill | Sign-in for asking; caps per adult, child and class; per-IP limit; monthly question cap and budget; pause after refusals; kill switch |
| Getting it to give unsafe advice, or to talk about anything | Ring-fence and safety rules in reviewed prompts; answer check; no tools or web access for the model; safety test set before any model or prompt change; refusals and blocks counted |
| A child sharing personal details or being drawn into personal talk | "Don't type your name" note; stripping; the prompt never asks personal questions and refuses personal topics; nothing stored |
| A child in distress | Trusted adult and Childline answer (§7.2) |
| Unreviewed Common questions with a mistake | Disclaimer; automatic safety check; children's rules; hidden at 3 👎 and redrafted; grounded only in the lesson text |
| Prompt injection | Only our own reviewed lesson text and the program's blocks are sent; free-text fields dropped |
| A free provider that keeps or trains on inputs | Provider checklist before it is allowed; never for children |
| Personal data in our logs | Logs off; tests that plant names, emails, phone and ID numbers and check what reached the (faked) provider and what was stored, like the M5 name-leak test |

## 8. Acceptance criteria
- [ ] A signed-in teacher asks on their home page and on a lesson page and gets a STEM answer with the disclaimer in under 10 s on a throttled 3G profile; a question about football or a diet is refused kindly.
- [ ] A child can ask on a lesson page only after their parent turns on control (e); turning a class's switch off stops it at once; signed-out visitors can't ask; the service refuses a child's request from any other page.
- [ ] The 6th question of a child's day and the 21st of an adult's are refused with the friendly message; the next day both work; three refusals pause the asker until tomorrow.
- [ ] At 20,000 questions or the month's budget, no further provider calls are made and the back office is emailed.
- [ ] A question with a learner's nickname, an email, a phone number and an ID number reaches the (faked) provider with none of them; nothing about it is stored or logged.
- [ ] Requests about mains, coin cells or lithium cells are refused; a planted unsafe answer or link from the (faked) provider is replaced or removed.
- [ ] A child writing that they are scared at home gets the trusted-adult and Childline answer.
- [ ] Common questions appear for a lesson without anyone in the back office doing anything, carry the disclaimer, work offline after one visit, and an answer with 3 👎 disappears.
- [ ] Switching the adults' model to another allowed provider in the back office works without a deploy; a model not on the allowed list can't be chosen.
- [ ] Repeated questions on one lesson hit the prompt cache.
- [ ] The usage screen shows no text and no ids; lesson pages that don't open the panel load no helper code; Lighthouse stays 90+.

## 9. Work plan for Claude Code
One PR per step; ⏸ marks a stop for review.
1. ✅ *(approved 2026-11-27)* **This spec** and **ADR-0018**, with CLAUDE.md §5 and §8 updated to match.
2. *(built 2026-11-27: migration 0028, 9 PGlite tests; settings live in the database so the owner's changes and the kill switch work at once)* **Database:** migration 0028 (usage, caps, consent control e, class switch, monthly totals, Common questions and votes, `helper_take`), PGlite tests.
3. **Helper Worker, core:** adult and child sessions, limits, stripping, lesson JSON at build, the Claude adapter (faked in tests), answer check, counts, safety test set in CI; deploy switch `HELPER_DEPLOY`; `docs/deploy.md`.
4. **Common questions:** the daily job, `/helper/faq/<lesson>`, 👎 hiding, offline caching.
5. **The panel:** adults' home page and lesson pages; children's lesson pages; offline, limit and paused states; 👍/👎; e2e tests at 360 px.
6. **Consent and class controls:** control (e) in Your children (notice v1.1), the class switch and weekly count in the class view.
7. **Back office:** AI → Helper settings, models per audience, usage; the provider checklist file and a second provider adapter if the owner names one.
8. ⏸ **People checks** (test plan): teachers and parents ask real questions; a class of Grade 4s with parent consent; a reviewer tries unsafe and off-topic requests in English and isiZulu; the live safety test set on each allowed model.

## 10. AI opportunities
👎 counts, hidden Common questions and refusals per lesson show where lessons are unclear; the back office can suggest lesson edits from them (drafts to review, CLAUDE.md §8).

## 11. Cost notes
Estimated cost per question, with about 6,000 tokens of system prompt and lesson (mostly cached), a short question and about 1,000 tokens of thinking and answer (to be measured in step 3), at the API's list prices today and about R18 to the dollar:

| Model | Input / output per million tokens | Rough cost per question | 20,000 questions a month |
|---|---|---|---|
| **Claude Haiku 5.5** (`claude-haiku-5-5`), **the start** | $0.10 / $0.50 | about $0.001 (R0.02) | about R400 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | about $0.01 (R0.20) | about R4,000 |
| Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | about $0.02 (R0.40) | about R8,000 |
| Other providers, including free ones | from their checklist | | |

The monthly budget starts at the Haiku figure for 20,000 questions plus Common questions (about R500), set and raised in the back office. Core stays free; a higher cap for school subscriptions is a later paid add-on.

## 12. Risks
- **Unreviewed Common questions** may contain mistakes; mitigated by the disclaimer, checks, children's rules and 👎 hiding (owner decision 6).
- **Children using AI** raises the stakes; mitigated by consent, class switches, caps, the stricter prompt and the test set; reviewed again after the people checks.
- **Free models** may be weaker or keep inputs; the checklist and test set decide, and never for children if they keep inputs.
- **Home-language answers** are not reviewed by people.
- **Cost spikes** from big events: caps and budget; the back office can raise the budget for a day.

## 13. Owner decisions (2026-11-27)
1. **Model:** start with **Claude Haiku 5.5**; allow other providers, including free models, through settings, each approved by the provider checklist (FR-24 to FR-27).
2. **Who and where:** adults (teachers, coaches, parents, personal learners) on **their home page** and lesson pages; **children on lesson pages only**, with parent consent, class switches and their own small cap (FR-1 to FR-9).
3. **Caps:** 20 questions per adult per day (setting); children 5 (setting); the platform **20,000 questions a month**, with the rand budget from the model's price (FR-20, FR-21).
4. **Questions:** no question or answer text stored. *(Accepted, with every other safeguard.)*
5. **Language:** the person's site language with the "Written by AI" label.
6. **Common questions:** drafted by AI, **no human review**, automatic checks only, disclaimer "AI can be wrong", hidden at 3 👎 (FR-15 to FR-19). This amends CLAUDE.md §8 for Common questions only.
7. *(Open, not blocking.)* A child who sounds unsafe: today the answer points to a trusted adult and Childline, and nothing is stored. Alerting anyone would mean storing children's words; not proposed.

**Owner actions** (when building starts):
- an Anthropic API account and key (a Worker secret);
- the Information Officer checks each provider's checklist (§7.1);
- the notice v1.1 wording for consent control (e);
- name any other provider to try.

## Version history
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-25 | First draft |
| 0.2 | 2026-11-27 | Owner decisions: STEM-education ring-fence; adults on their home page and lesson pages; children on lesson pages with parent consent, class switch and caps; Common questions AI-drafted without review, with disclaimer and automatic checks; Claude Haiku 5.5 first, other providers including free ones behind a checklist; 20 a day per adult, 20,000 a month for the platform |
| 0.3 | 2026-11-27 | Approved by the owner; ADR-0018 accepted |
