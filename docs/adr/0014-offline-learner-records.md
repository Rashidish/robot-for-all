# ADR-0014: Offline learner records

- **Status:** Proposed
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
Learners record answer sheets (answer-sheets Part B, M5 FR-11 to FR-13) on phones that are often offline, and several learners share one phone. CLAUDE.md non-negotiable 3: progress syncs when a connection returns.

## Options considered
| Option | Size | Conflicts | Notes |
|---|---|---|---|
| A. **Per-learner outbox in IndexedDB**, idempotent records, sent by our own code | ~2 KB of code | None: each record has one writer | No dependency |
| B. A sync library (e.g. RxDB, PowerSync) | 50–200 KB | Handled by the library | More than we need; licences and hosting vary |
| C. Online only | 0 | None | Breaks non-negotiable 3 |

## Decision
**A:** a small outbox per learner in IndexedDB, sent to Supabase when online.

## How
- Each record has a client-made id: hash of (learner, lesson, sheet code, recorded time). Sending twice is harmless (`insert … on conflict do nothing`).
- One outbox per learner, keyed by learner id; it is sent only with that learner's token (ADR-0013), so records never end up under someone else even if another learner signs in first.
- Sent on `online`, on app start, and every 5 minutes while open; Background Sync where the browser has it.
- **Writers:** only the learner writes their records; teachers write only `checked` and `revoked` marks on other columns (row-level security). So there are no edits to merge.
- The learner sees "saved on this phone, will be sent" until the server confirms.
- Signing out keeps unsent records for that learner until they are sent; "remove this learner from this phone" asks first if anything is unsent.

## Consequences
- Easier: tiny, auditable, no dependency, matches the hand-written service worker (CLAUDE.md §5).
- Harder: we own retry and error handling; tests must cover two learners on one phone, and going offline mid-send.
- Watch: IndexedDB can be cleared by the browser under storage pressure; request persistent storage and show unsent counts.
