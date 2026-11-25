# @robots-for-all/db

Database migrations for Supabase (ADR-0010, `docs/specs/back-office.md`). Plain SQL, applied in
file-name order. Every permission is enforced here, in the database, with row-level security.

| Migration | What it sets up |
|---|---|
| `0001_back_office_roles_and_audit.sql` | Back-office roles (super admin, owner, reviewer, …), `grant_role` / `revoke_role`, at-least-one-super-admin rule, insert-only `audit_log`, `log_action`, super-admin `record_override` (needs a written reason), `bootstrap_super_admin` |
| `0002_back_office_people.sql` | The people screen: `admin_people()` (everyone with a role, with email) and `grant_role_by_email`, owners and super admins only |
| `0003_content_reviews.sql` | Content review: `admin_profiles` (public reviewer names), append-only `content_reviews`, `record_review` (roles, ticks, notes, not your own), `approved_pull_request` |
| `0004_decided_pull_requests.sql` | ADR-0012 condition 4: any recorded decision lets its own pull request merge |
| `0005_withdraw_and_more_content.sql` | Withdraw / restore (`record_withdrawal`), content types template/world/season/language, the seventh (templates) tick |
| `0006_world_reviews.sql` | Worlds and courses are reviewed with their own checklist (`review_checklist_keys_for`); `record_review` for lessons and worlds |
| `0007_reviewer_languages.sql` | The languages each person reads (`admin_profiles.languages`, `set_reviewer_languages`, `reads_language`), for translation approvals |
| `0008_language_reviews.sql` | Languages are reviewed: their own five ticks, only a reviewer who reads the language approves, translators send it for review, no build test |
| `0009_translation_reviews.sql` | Lesson translations are reviewed (type `translation`, id `<lesson>/<language>`): the language ticks plus "I read every section", a reviewer who reads that language, no build test |
| `0010_teach.sql` | M5 Teach (spec `docs/specs/M5-teach.md`): organisations (verified once), classes with class codes and enrolment links, learners by nickname with the certificate name only as ciphertext (ADR-0015), guardians, consent controls, school/club enrolments pending a parent's confirmation (14 days), answer-sheet records written by the learner's own session (ADR-0013, ADR-0014), spot-checks, automatic badges, verification codes that outlive the learner, and deletion when no longer needed (dormancy messages at 10 and 11 months, deletion at 12) |
| `0011_staff_invitations.sql` | Staff join a school or club by a one-time invitation link the admin shares themselves (only the secret's hash is kept; 7 days; works once); the staff list by chosen names; removing staff, never the last admin |
| `0012_parent_view.sql` | A parent sees the classes (and school or club names) of their own children only, through `my_children_classes()`; parents still can't read classes or their codes |
| `0013_show_names.sql` | Show names (M5 FR-22a): the certificate service (service role only) gets a class's encrypted names for its own staff at a verified school or club, only with all three consents; each reveal is logged without the names (`name_reveals`, readable by Support) |
| `0014_school_enrolment.sql` | School and club enrolment (M5 FR-5a): service-only helpers for the certificate service (`class_label`, `pending_for_token`, `drop_pending_enrolment`) and `cancel_pending_enrolment` for a class's staff |
| `0015_confirmed_deletion.sql` | Dormant accounts deleted only once the data protection officer confirms (`deletion_due_list`, `confirm_deletions`, `keep_account` with a reason); the daily job's `mark_due_for_deletion`, `lock_unconfirmed_deletions` (30 days), `delete_after_lock` (30 more); locked accounts can't be used and their learners can't sign in; replaces `delete_dormant_accounts` |
| `0016_daily_job.sql` | For the daily job: the enrolment link's secret kept locked for reminders (`store_pending_token`, `pending_reminders_due`, `pending_reminder_sent`), `dormancy_warnings_due` with the adult's own email, `job_due` so the back-office notice goes every 7 days |
| `0017_learner_sign_in.sql` | Learner sessions (ADR-0013 amendment): `session_version` checked by `current_learner()` so "sign out everywhere" (`revoke_learner_sessions`) ends old tokens; for the sign-in service only, `learner_for_sign_in` (one learner on one class's roster) and `choose_learner_pin` (only while none is set) |
| `0018_cards_and_learner_status.sql` | The teacher's view of sign-in (`class_learner_status`: has pictures, locked; never the PIN) and QR sign-in cards (`sign_in_cards`, only the secret's hash; `create_sign_in_cards` replaces old ones, `revoke_sign_in_cards`; `card_for_sign_in` for the sign-in service only) |
| `0019_badge_awarding.sql` | For awarding badges (service only): `badge_records` (not revoked; only checked where a class needs a check), `learners_with_new_records`, `learner_guardian_emails` (nickname and language, never the name); `whoami_learner` for a learner session |
| `0020_badge_reviews.sql` | Badges reviewed like worlds: content type `badge`, its checklist (`picture_clear`, `no_words`, `words_right`, `rule_fair`, `child_safe`), no build test |
| `0021_badges_need_check.sql` | `set_badges_need_check`: a class's teachers and coaches decide whether only checked records count towards badges (FR-15) |
| `0022_certificate_label.sql` | `certificate_label`: which school or club a certificate names (the one whose teacher checked a record, else the newest class; "(not yet verified)" until verified; "Robots For All" if none) |
| `0023_certificates_for.sql` | `certificates_for` (service only): which awards an adult may print (their child's, or a class they teach), with the encrypted name only under consent b; never revoked badges |
| `0024_family_and_personal.sql` | Family groups (organisation kind `family`, one class, the parent's own children only, at most 8; no enrolment link, cards, staff, school enrolments, verification or check marks, enforced by triggers; a second parent by a confirmed one-time link) and personal learners (`learners.self_user_id`, 18+, own consent); `guardian_learner_session` for "Learn as <child>"; family certificates name Robots For All |
| `0025_family_waiting.sql` | `family_invitations_waiting`: who opened a family group's second-parent link (their chosen name), for the first parent to confirm |
| `0026_my_personal_learner.sql` | `my_personal_learner`: the adult's own learner profile, so the account page shows it as "Learning myself" and not as a child |

## Tests

`npm test` runs `src/*.test.ts` on **PGlite** (real Postgres compiled to WebAssembly, Apache-2.0,
dev dependency only) with `test-support/supabase-stub.sql`, a stand-in for the few Supabase
pieces the migrations use (`auth.users`, `auth.uid()`, `auth.jwt()`, the `anon`,
`authenticated` and `service_role` roles). No server or Docker is needed, locally or in CI.

## Applying to Supabase (owner, once the project exists)

1. In the Supabase dashboard: **Authentication → Multi-factor** on (TOTP).
2. Apply the migrations in order (Supabase CLI `supabase db push`, or paste each file into the SQL editor).
3. Create your own account (sign up once in the admin app, or **Authentication → Users → Add user**), set up your authenticator app, then make yourself the first super admin with the service key (SQL editor runs as the owner, which is allowed):
   ```sql
   select public.bootstrap_super_admin((select id from auth.users where email = 'you@example.org'));
   ```
   This works only once: when a super admin exists it refuses.
4. Create the **break-glass** account the same way, put its password and MFA recovery codes in the password-manager vault, and grant it `super_admin` from your own account in the admin app.

Never put the service key in a page or in the repository: it lives only in the admin app's
Cloudflare secrets (ADR-0009).
