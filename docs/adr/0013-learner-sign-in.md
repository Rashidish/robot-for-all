# ADR-0013: Learner sign-in on shared phones

- **Status:** Accepted (owner, 2026-11-25)
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
M5 (`docs/specs/M5-teach.md` §6.4) needs learners from Grade 3 to sign in, often several to one cheap, shared phone, and offline afterwards. Learners have no email or phone (POPIA: collect the minimum), and they are not Supabase Auth users. Non-negotiables: cheap phones, low data, offline, accessible, child safety.

## Options considered
| Option | Speed for a Grade 3 learner | Offline after sign-in | Risk | Notes |
|---|---|---|---|---|
| A. Class code → tap nickname → **picture PIN** (4 taps from 9 pictures) | ~10 s | Yes (30-day token) | 6,561 combinations; rate limit and lock | No typing; pictures easier to remember than digits at 8–9 years |
| B. Printed **QR sign-in card** per learner | ~5 s | Yes | A lost card signs in anyone who finds it | Good for events; needs a camera |
| C. Username + password | Slow, forgotten often | Yes | Weak passwords; typing hard on phones | Rejected |
| D. Teacher signs each learner in | Slow for 30 learners | Yes | None extra | Admin-heavy; rejected for scale |

## Decision
**A for classes, B as an option for events**, both issuing the same kind of session from a small sign-in Worker.

## How
- The sign-in Worker (Cloudflare, ADR-0011 pattern) checks class code + learner id + picture PIN against a hash (Argon2id via WebAssembly or PBKDF2 in Web Crypto; the PIN space is small, so the rate limit is the real defence).
- **Limits:** 5 wrong tries per learner → 5-minute lock and the teacher sees it; 50 tries per class per minute; per-IP limit.
- **Session:** a signed token (Ed25519, key only in the Worker) naming one learner, valid **30 days on that device**, revocable by the teacher (sessions list per learner; token version bump). Stored in IndexedDB, not cookies, so learners on one phone don't share a session.
- **Row-level security:** the database accepts the learner token (custom JWT claim `learner_id`) for that learner's own rows only.
- **QR cards** carry a random one-time-per-card secret (not the PIN), printable in bulk by the organiser, revocable per card; no names, only the nickname.
- **Accessibility:** pictures have text names for screen readers; a four-digit PIN fallback.

## Consequences
- Easier: no learner email or phone; quick sign-in; works offline after the first sign-in.
- Harder: a small PIN space depends on rate limiting, so the Worker must be tested for it; teachers handle forgotten PINs (one-tap reset).
- Watch: shared phones keep several learners' tokens; the "who's using this phone?" screen must make switching obvious, with sign-out after 10 minutes idle.

## Amendment 1 (owner decision, 2026-11-25)
Supabase accepts only sessions signed with its own JWT secret, so the learner session is **signed with
that secret (HS256)**, not an Ed25519 key of our own. The owner chose this over having the sign-in service
write records with the service key, so that **the database's own rules** keep each learner to their own
rows (migrations 0010 and 0017).
- **Where the secret lives:** only in a separate small Worker, `apps/signin` on `/signin/`, never in the
  certificate service, the Pages project or a browser; vaulted with the name key (docs/deploy.md §8).
- **The token:** role `authenticated`, kind `learner`, `learner_id`, and `sv`, the learner's session
  version. A teacher, coach or parent's **sign out everywhere** bumps the version, and the database then
  refuses older tokens.
- **PINs:** PBKDF2-SHA256 with a random salt, bound to the learner. A first PIN (or one after a reset)
  can be chosen only while none is set.
- **Limits:** the per-class limit is 100 tries a minute, not 50, so a class of 40 can sign in together.
- **Built (M5 step 5c):** QR cards as above (`/signin/card`, migration 0018), the teacher's view of locks and pictures, one-tap reset and "sign out everywhere".
