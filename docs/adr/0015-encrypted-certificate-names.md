# ADR-0015: Encrypting the certificate name

- **Status:** Accepted (owner, 2026-11-25)
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
Owner decision (M5 spec §4.5): a learner's real name is stored so certificates and badge cards can be printed in bulk, but **encrypted**, never shown on any screen, and seen only on the produced certificate. POPIA s19 requires appropriate safeguards; the name is the only real name in the system.

## Options considered
| Option | Who can read names | Key location | Notes |
|---|---|---|---|
| A. **Field-level AES-256-GCM in a certificate Worker**; key only in that Worker's secrets | Only the certificate service, in memory | Cloudflare secret (+ offline copy in the owner's vault) | Database, backups and back office hold ciphertext |
| B. Postgres column encryption (pgsodium / Supabase Vault) | Anyone with database access and the right role | Inside the database platform | A database admin or leaked service key can decrypt |
| C. Plain text with row-level security | Database admins, backups, any leak | — | Rejected (owner: encrypted) |
| D. Not stored; typed at print time | Nobody | — | Owner rejected: admin-heavy for large events |

## Decision
**A:** encrypt in the certificate Worker with AES-256-GCM; the key never enters the database or a browser.

## How
- **Encrypt on arrival:** the enrolment page and class-list upload send names only to the certificate Worker, which encrypts and stores `{key_version, nonce, ciphertext}`. Plain names never reach Supabase, its logs or its backups.
- **Associated data:** the learner id is bound into each encryption, so a ciphertext copied onto another learner fails to decrypt.
- **Decrypt only to print:** the Worker checks the caller may print for each learner (class staff, guardian, event organiser), decrypts in memory, draws the PDF, streams it with `Cache-Control: no-store`, and logs only counts.
- **Keys:** a 256-bit key per version in Cloudflare secrets; rotation re-encrypts in the background; the owner keeps an offline copy in the password-manager vault (losing the key loses the names).
- **Tests:** after enrolment and after printing, an automated test searches the database, Worker logs and browser storage for the test name and fails if it finds it anywhere but the PDF.

## Consequences
- Easier: a database or backup leak reveals no names; back-office staff never see them.
- Harder: search by name is impossible (by design); a second Worker to run; key management is an owner responsibility.
- Watch: never add the name to error messages, analytics or AI prompts; code review checks every new use of the certificate Worker.
