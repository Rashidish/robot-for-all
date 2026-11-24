# Spec: M5 — Teach (accounts, classes, progress, badges and certificates)

> **Version:** 0.1 (draft) · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Draft, for owner review
> Builds on: answer-sheets spec Part B (approved in principle), back-office spec (People, Badges, Privacy modules), ADR-0010 (accounts and roles), CLAUDE.md §7 (POPIA). Owner request 2026-11-24: also decide how learners' names get onto certificates and badges, and where the names come from.

## 1. Purpose

Up to M4 nobody signs in: every lesson, template and the code editor work without an account, and that stays true (CLAUDE.md §2.6, free at the core). M5 adds what teachers, coaches and parents need to **run a class and see progress**, without turning a children's learning site into a store of children's personal data:

- a teacher or coach makes a class, adds learners by **nickname**, and sees who has done what;
- a learner records their answer sheets (answer-sheets Part B) and earns **badges**, on a shared phone and offline;
- a parent or guardian gives **consent**, sees their child's progress and can delete it;
- a teacher or parent prints a **certificate** with the child's real name, without that name ever being stored.

## 2. Scope

**In scope:** adult accounts (teacher, coach, parent/guardian); schools, clubs and classes; learner profiles (nickname, no email); parental consent; learner sign-in on shared devices; answer-sheet records (Part B) with offline sync; teacher check marks; progress views for teacher, coach and parent; badges; printable certificates; the back-office People, Badges and Privacy modules; deleting data.

**Out of scope (later specs):** competitions and public leaderboards; live help sessions; the AI helper (M6); WhatsApp parent questions; kit orders; recording robot-world runs (the run report stays on the device, as in M4); payments and paid school dashboards.

## 3. Users and journeys

**Teacher (Grade 3–7, one shared phone or a computer lab)**
1. Signs up with email. Their account is "unverified teacher" until verified (§7.4); until then they can create one class of up to 40 learners for trying it out.
2. Creates a class ("Grade 4B Robotics"), chooses the grade and the site language.
3. Adds learners by **nickname only** (e.g. "Thandi R", "Rocket"); the app warns if a nickname looks like a full name.
4. Prints **consent letters**: one page per learner, in the class's language, with a short link and code for the parent. Learners can't record anything until consent is given (§7.2).
5. In class, learners sign in on the shared phone: class code → tap their nickname → their **picture PIN** (§6.3).
6. Sees the **progress grid** (learners × lessons), ticks sheets **checked** against the signed paper, and prints certificates.

**Coach (club, library, community centre)**: the same as a teacher, with a **club** instead of a school; one coach can run several clubs.

**Parent or guardian**
1. Opens the consent link from the letter, reads what is collected and why (§7.1) in their language, and **consents** (or declines).
2. Optionally creates a parent account (email) to see their child's progress and badges, print certificates, and **delete** the child's profile at any time.
3. A parent can also create a learner profile at home (homeschool), with no school or teacher involved.

**Learner**
1. Signs in on a shared device (class code, nickname, picture PIN) or stays signed in on their own family phone.
2. After a lesson, enters the **sheet code** from their paper answer sheet and ticks what the sheet shows (answer-sheets FR-B2), online or offline.
3. Sees their lessons done, "Not yet" items to work on, and badges earned. Never sees other learners' records, and can't message anyone.

## 4. Functional requirements

### 4.1 Accounts and classes
| ID | Requirement |
|---|---|
| FR-1 | Adults sign up with email (Supabase Auth, ADR-0010): teacher, coach or parent/guardian. One person may hold several of these roles. MFA is optional for adults in M5, required for back-office roles (as today). |
| FR-2 | A teacher belongs to a **school**; a coach to a **club**. Schools and clubs are created by their first teacher or coach and confirmed in the back office (§7.4). |
| FR-3 | A **class** has a name, grade band, language, a teacher or coach (one or more), and up to 60 learners. A class code (6 letters, no vowels to avoid words) is used for learner sign-in and can be changed at any time. |
| FR-4 | A **learner profile** has a nickname (unique in the class, 2–20 characters), a grade, an avatar picked from a set of drawings, a preferred language, and a picture PIN. Nothing else. |
| FR-5 | A learner can be in more than one class (school and club). A parent's home learner profile can later be linked to a class with the parent's agreement. |
| FR-6 | Teachers can move learners between their classes, reset a picture PIN, and archive a class at the end of the year (§7.5). |

### 4.2 Consent
| ID | Requirement |
|---|---|
| FR-7 | A learner profile is **pending** until consent is recorded. Pending learners can sign in and use lessons (no account is needed for that anyway) but nothing is recorded for them. |
| FR-8 | **Online consent (primary):** the parent opens the link from the consent letter, reads the notice, enters their email (to receive a copy and to manage consent later) and consents. Consent records: which learner, which parent email, notice version, date, how it was given. |
| FR-9 | **Paper consent (where parents have no internet):** the parent signs the printed consent letter; the school keeps it; the teacher ticks "signed paper consent kept by the school" for that learner. The school is the responsible party for that paper (owner decision 1). No photo or scan of the paper is uploaded. |
| FR-10 | A parent (by link or account) or the teacher on the parent's instruction can **withdraw** consent at any time: recording stops at once and the learner's records are deleted within 7 days (§7.5). |

### 4.3 Progress (answer-sheets Part B)
| ID | Requirement |
|---|---|
| FR-11 | Answer-sheets FR-B1 to FR-B8 as approved: learners record their own sheets by sheet code; team sheets are recorded by each member; no free-text answers; "Not yet" never earns a badge. |
| FR-12 | Recording works **offline**: records are kept on the device (IndexedDB) and sent when a connection returns (ADR-0014). The learner sees "saved on this phone, will be sent later". |
| FR-13 | On a shared device, a learner's unsent records are kept separately per learner and are sent under that learner's profile only, even if another learner signs in before the phone goes online. |
| FR-14 | Teacher/coach **progress grid**: learners × lessons, showing done, "Not yet" items, built and working, and checked. Filter by phase. Tap a cell to mark it **checked** against the signed paper sheet. |
| FR-15 | **Parent view:** their child's lessons done, "Not yet" items and badges, in the parent's language. |

### 4.4 Badges
| ID | Requirement |
|---|---|
| FR-16 | Badge definitions are **content** (`content/badges/<id>.json` + `<id>.svg`), reviewed like seasons: a name and description (translated), artwork, and a rule. |
| FR-17 | First rules: complete a lesson (all steps, "built and working"); all "I can" checks "Yes" for a lesson; complete N lessons of a phase; complete every lesson of a mechanism; Season 1 badge (finish the season's course for your grade band, recorded by the teacher in M5 since runs stay on the device). |
| FR-18 | A badge counts only **checked** records (owner decision 4, recommended) so a badge means a teacher saw the work. Home learners' badges are confirmed by their parent instead. |
| FR-19 | Badges show in the learner's profile with the **nickname** only. There is no public badge page in M5. |

### 4.5 Certificates and printed badges: where the name comes from (owner question)
| ID | Requirement |
|---|---|
| FR-20 | A **certificate** (A4) or **badge card** (A6, four to a page) can be printed for any badge the learner has earned, by their teacher, coach or parent. It shows the badge artwork, badge name, the date, the school or club name, the teacher's or coach's name as they chose it, and a **verification code**. |
| FR-21 | **The learner's real name is typed on the device at print time and never stored or sent** (owner decision 3, recommended). The print screen shows the nickname and an empty "Name on the certificate" box; whatever is typed goes only into the page drawn in the browser for printing, and is cleared when the screen closes. It is not saved in the database, the device's storage, logs or analytics, and is not part of the verification code. |
| FR-22 | **No-name option:** "Print with a blank name line" leaves a line to write the name by hand, for teachers who prefer a pen, or when the person printing doesn't know the full name. |
| FR-23 | **Class batch printing:** the teacher can print certificates for several learners at once: the print screen lists the selected nicknames, each with its own name box (or blank line). Names are kept only in that screen's memory until it closes or is printed. |
| FR-24 | The **verification code** (e.g. `RFA-7K3P-Q9`) lets anyone confirm a certificate at `/verify/` (works without an account): it shows the badge, the date, and the school or club. It never shows the nickname or any name. Codes are random (not derived from the learner), and a teacher or parent can revoke one. |
| FR-25 | Certificates are printed in the language chosen on the print screen (the class or parent language by default). All fixed text is interface words; badge names come from the badge's translations. |
| FR-26 | Digital badges in the app never show a real name: the app has none to show. |

## 5. Non-functional requirements
- **Public pages stay as they are:** lessons, templates and the code editor need no account and load no account code. Account code loads only on `/class/…` pages, as a separate Svelte island, within a 120 KB compressed budget.
- **Offline:** signing in once on a device keeps that learner signed in for 30 days on that device; recording works offline (FR-12); class lists for the teacher are cached for reading offline.
- **Shared, cheap phones:** sign-in in under 15 seconds for a Grade 3 learner; large tap targets; works at 360 px; no typing for learners except the sheet code.
- **Languages:** every screen, consent letter, notice, badge and certificate goes through translation, with English first.
- **Accessibility:** WCAG 2.2 AA; picture PINs have text alternatives and a non-picture fallback (four-digit PIN) for learners who use a screen reader.

## 6. Technical architecture
### 6.1 Data model (Supabase Postgres, row-level security everywhere)
```
schools(id, name, province, verified)           clubs(id, name, area, verified)
adults(user_id → auth.users, display_name)      -- the name an adult chooses to show
adult_roles(user_id, role: teacher|coach|parent, school_id?, club_id?)
classes(id, school_id?, club_id?, name, grade_band, language, class_code, archived_at)
class_staff(class_id, user_id)
learners(id, nickname, grade, avatar, language, pin_hash, created_by, home_parent_id?)
class_learners(class_id, learner_id)
consents(learner_id, parent_email?, kind: online|paper_kept_by_school, notice_version,
         given_at, withdrawn_at, recorded_by)
sheet_records(learner_id, lesson_id, sheet_code, steps_done, i_can, built_working,
              team_sheet, recorded_at, checked_by?, checked_at?)
badge_awards(learner_id, badge_id, awarded_at, rule_version)
certificate_codes(code, badge_award_id, school_or_club, issued_by, issued_at, revoked_at)
```
No column anywhere holds a learner's real name, surname, birth date, photo or contact details. A parent's email is stored only on the consent record (to send a copy and to manage consent) and on the parent's own account.

### 6.2 Where the pieces live
- Same Supabase project as the back office (one place to manage people, back-office spec), with separate tables and policies; learners are **not** Supabase Auth users (they have no email).
- `apps/web`: `/class/` (teacher/coach), `/home/` (parent), `/me/` (learner), `/consent/<code>/` and `/verify/` pages, as Svelte islands calling Supabase with row-level security. No service key ever reaches the browser.
- A small **Cloudflare Worker** endpoint does what the browser must not: issue a learner session after a class code + nickname + PIN check (rate-limited), and send consent emails. The same deployment pattern as the back office (ADR-0011).
- Certificates are drawn in the browser as SVG/HTML for printing (like template sheets); the typed name never leaves that page (FR-21).

### 6.3 Learner sign-in on a shared device (ADR-0013, to write)
- **Recommended (owner decision 2):** class code → tap your nickname in the class list → tap 4 pictures in order from a grid of 9, repeats allowed (a **picture PIN**; 9⁴ = 6,561 combinations, with 5 tries then a 5-minute lock and the teacher told). Learners remember pictures better than numbers at Grade 3.
- The session is a short-lived signed token for that learner only, kept on the device for 30 days, ended by "Sign out" or by the teacher.
- Alternative: a printed **QR sign-in card** per learner (scan with the phone's camera). Quicker, but a lost card is a sign-in for anyone who finds it.

### 6.4 Offline progress (ADR-0014, to write)
An outbox in IndexedDB per learner; records are idempotent (learner, lesson, sheet code, recorded_at), so sending twice changes nothing. Only the learner writes their records and only the teacher writes the checked mark, so there are no conflicting edits to merge.

## 7. Security, privacy and child safety (POPIA)
### 7.1 What is collected and why
| Data | Why | Legal basis |
|---|---|---|
| Learner nickname, grade, avatar, language, picture PIN (hashed) | Sign in, show progress | Consent of a competent person (parent/guardian), POPIA s35(1)(a) |
| Sheet records, checks, badges | The record of learning the class is for | Same consent |
| Adult email, display name, role | Account, sign-in | Consent of the adult; contract (terms of use) |
| Parent email on a consent record | Copy of the consent; manage or withdraw it | Consent |
| School/club name, area | Group classes; verify teachers | Legitimate interest of the school or club |

**Not collected:** learner real names, surnames, birth dates, ID numbers, photos, voice, location, contact details, free-text answers, device identifiers for tracking. The certificate name is typed at print time and never stored (FR-21).

### 7.2 Consent
Consent letters and online notices are short, in plain words, and in the family's language. No recording happens before consent (FR-7). Withdrawal is as easy as giving it (FR-10). The notice version is recorded, so a changed notice asks for consent again.

### 7.3 Child safety
- There is **no messaging** of any kind: not learner–learner, not adult–learner. Teachers see only their own classes.
- Nicknames are checked for full names and rude words (a word list per language) and are visible only inside the class.
- Learners never see other learners' records; class lists show nicknames and avatars only.

### 7.4 Who can be a teacher or coach
Anyone can sign up, but an **unverified** teacher or coach can make only one trial class of up to 40 learners, and their learners can't earn printable certificates. The back office verifies a school or club (Support role: a school phone number or official email domain; a club's registered organisation or library) and then its teachers or coaches (owner decision 5).

### 7.5 Keeping and deleting data
- Withdrawn consent: records deleted within 7 days.
- Archived class: learner profiles that are in no other class are deleted **12 months** after the class is archived (owner decision 6); the teacher is reminded before.
- Parent or teacher "delete this learner": deleted at once, with backups expiring in 30 days.
- Accounts unused for 24 months: the adult is emailed; deleted 30 days later if they don't sign in.
- The back-office Privacy module records access and deletion requests and keeps a breach log (back-office spec).

### 7.6 Threat notes
| Threat | Mitigation |
|---|---|
| Someone guesses a learner's picture PIN on a shared phone | Rate limit and lock (§6.3); teacher sees attempts; worst case they can tick someone else's sheet, which the teacher's check catches |
| A stranger signs up as a "teacher" to gather children | No real names, photos or contact details exist to gather; unverified teachers are limited (§7.4); no messaging; every class and its staff is visible in the back office |
| A teacher sees another class | Row-level security on every table by class staff; tests on PGlite as for migrations 0001–0009 |
| The real name on a certificate leaks | It is never stored or sent (FR-21); an e2e test watches network requests and storage while printing and fails if the typed name appears in any of them |
| A verification code reveals a child | It shows only badge, date and school or club (FR-24); codes are random |
| Data breach | Minimal data (§7.1); passwords and PINs hashed; service key only in Workers; breach log and the POPIA s22 notification steps in the Privacy module |
| A child is in a family dispute (one parent consents, the other objects) | Either parent or guardian can withdraw consent; the school follows its own policy for paper consent |

## 8. Acceptance criteria
- [ ] A teacher creates a class, adds 30 learners by nickname, and prints 30 consent letters in English and isiZulu.
- [ ] A parent consents online; that learner can now record sheets; a learner without consent can sign in but nothing is recorded.
- [ ] A Grade 3 learner signs in on a shared phone with class code, nickname and picture PIN in under 15 seconds (test plan, with children).
- [ ] Two learners record sheets on the same phone offline; when the phone goes online each record arrives under the right learner.
- [ ] The teacher checks records; a badge is awarded only from checked records; "Not yet" never counts.
- [ ] A parent sees their child's progress and deletes the profile; it is gone from every view at once.
- [ ] A certificate prints with the name typed at print time; an automated test proves the name appears in no network request, no storage (IndexedDB, localStorage, cookies) and no log.
- [ ] A certificate's verification code shows badge, date and school at `/verify/`, and no name or nickname.
- [ ] Row-level security tests: a teacher can't read another class; a learner can't read another learner; a parent sees only their own child.
- [ ] Public lesson pages load no account code (size test), and Lighthouse stays 90+.

## 9. Work plan for Claude Code
One PR per step; ⏸ marks a stop for review.
1. ⏸ **This spec** approved; then **ADR-0013** (learner sign-in) and **ADR-0014** (offline records) for review.
2. **Database:** migrations for §6.1 with row-level security, consent and deletion functions; PGlite tests for every policy.
3. **Adults, schools and classes:** sign-up, school/club, classes, adding learners by nickname, class codes; back-office People module and teacher verification.
4. **Consent:** letters (printable, translated), the online consent page, paper consent tick, withdrawal; back-office Privacy module (requests, breach log).
5. **Learner sign-in and records:** the sign-in Worker, picture PIN, the `/me/` page, answer-sheet recording (Part B) offline with the per-learner outbox.
6. **Teacher and parent views:** the progress grid with checking; the parent view.
7. **Badges:** the badge format in content, the first badges, awarding from checked records; back-office Badges module.
8. **Certificates:** print screen (single and batch), name typed at print time, blank-line option, verification codes and `/verify/`; the privacy test for typed names.
9. ⏸ **People checks** (test plan): sign-in with Grade 3 learners, consent letters read by parents, a certificate printed at a school.

## 10. AI opportunities
None in M5. Nothing about learners goes to any AI (CLAUDE.md §7).

## 11. Revenue notes
Core stays free. Later paid add-ons this makes possible: school dashboards across classes, printed certificate packs, verified competition entries.

## 12. Risks
| Risk | Effect | Mitigation |
|---|---|---|
| Parents without internet can't consent online | Learners can't record | Paper consent kept by the school (FR-9) |
| Learners forget picture PINs | Lost lesson time | Teacher resets in one tap; QR card option |
| Teachers want real names in the app | Pressure to collect more | Certificates get names at print time; the class list uses nicknames the teacher chooses ("Thandi R") |
| Shared phone used by many classes | Mixed-up records | Per-learner outbox; sign-out reminder after 10 minutes idle |

## 13. Owner decisions (with recommendations)
1. **Consent routes:** online parent consent as the main route, plus paper consent kept by the school (recommended), or online only.
2. **Learner sign-in:** class code + nickname + picture PIN (recommended), or QR sign-in cards, or both.
3. **Names on certificates and badges:** typed at print time and never stored, with a blank-line option (recommended); or store a "certificate name" (first name and surname) per learner with parental consent, which is more data to protect for one printed line.
4. **Badges need a teacher's check mark** (recommended), or self-recorded results count.
5. **Teacher and coach verification** by the back office before certificates (recommended), or open to all.
6. **Retention:** delete learners 12 months after their class is archived (recommended), or at the end of each school year.

## Version history
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft, including where certificate and badge names come from (owner request) |
