# ADR-0012: The back office merges content changes a reviewer approved

- **Status:** Accepted (owner, 2026-11-24: content review spec Option B). Amends [ADR-0009](0009-back-office-architecture.md)'s "a person merges on GitHub" for one narrow kind of pull request.
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
ADR-0009: the back office opens pull requests through a GitHub App, and branch protection on
`main` makes a person approve and merge them on GitHub. For publishing lessons
(`docs/specs/back-office-content-review.md`) that means a reviewer approves in the back office
and then someone approves again on GitHub: two reviews, and every reviewer needs a GitHub account.

## Options considered
| Option | Steps for a reviewer | Accounts | Risk |
|---|---|---|---|
| A. Owner approves and merges every pull request on GitHub | Back office, then GitHub | GitHub for the owner | Slow; the owner is a bottleneck |
| B. **The back office merges after a recorded approval and green CI** | Back office only | Back office only (MFA) | The App can merge: limited to its own, status-only pull requests (below) |

## Decision
Option B. The back office's GitHub App may merge a pull request **only when all of these hold**,
checked by the server just before merging:

1. The pull request was **opened by the App itself**, from a branch named `admin/…`.
2. Its diff changes **only** content front matter status fields (`status`, `reviewed_by`, `build_tested_by`) of **one** lesson file, or one season or site settings file the back office wrote, compared with `main` at merge time.
3. **CI passed** on its latest commit (all required checks green).
4. A person with the right role (with MFA) **approved it in the back office**, and that approval is recorded in `content_reviews` and the audit log; for lessons, the approver is not the person who sent it for review (only a super admin overrides, with a reason).

Everything else (code, lesson text, worlds, anything the App didn't open) still needs a person to
approve and merge on GitHub. The ruleset on `main` keeps "CI must pass" for everyone, including the
App; the App is on the bypass list **only** for the "1 approval" rule.

## Why
- Reviewers work in one place, with MFA and the checklist; the decision is recorded with who and why.
- The App's merge power is narrow and checked twice: by the server's rules above and by CI.
- Season dates and site settings get the same one-step flow, still with green CI.

## Consequences
- Owner set-up: give the App **Pull requests: write** (already) and add it to the `main` ruleset's bypass list for the approval rule only (`docs/deploy.md` §5).
- The back office checks the pull request's files and CI status through the API before merging; tests cover each refusal.
- If the App's key leaks, an attacker could merge only status-only changes to content files that pass CI; rotate the key at once (ADR-0009). A published lesson still needs `reviewed_by` and `build_tested_by` (schema).
