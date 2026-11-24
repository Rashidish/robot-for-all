# Spec: M5 — Teach (enrolment, classes, progress, badges and certificates)

> **Version:** 0.2 (draft) · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail · **Status:** Draft, revised after owner feedback, for review
> Builds on: answer-sheets spec Part B (approved in principle), back-office spec (People, Badges, Privacy modules), ADR-0010 (accounts and roles), CLAUDE.md §7 (POPIA).
> **Owner direction (2026-11-24):** (1) learners' names may be stored, **encrypted**, as POPIA allows with proper security safeguards; a name is never seen on screen while printing, only on the printed certificate or badge; (2) parents give consent **online during enrolment**, with controls; no paper consent, because securing signed paper is its own POPIA problem; (3) avoid admin-heavy steps that don't work for **large-scale events**.

## 1. Purpose

Up to M4 nobody signs in: every lesson, template and the code editor work without an account, and that stays true (CLAUDE.md §2.6, free at the core). M5 adds what teachers, coaches, parents and event organisers need to **run classes and events and recognise learning**, at the scale of many schools and big events:

- a parent **enrols** their child online, giving consent with controls, the child's name for certificates (stored encrypted) and a nickname;
- a learner records their answer sheets (answer-sheets Part B) and earns **badges**, on a shared phone and offline;
- a teacher or coach sees their class's progress without data entry;
- certificates and badge cards are produced **in bulk**, with each learner's real name printed on them and nowhere else.

## 2. Scope

**In scope:** adult accounts (parent/guardian, teacher, coach, school or club admin); schools, clubs and classes; **online enrolment with consent controls**; learner profiles; the encrypted certificate name; learner sign-in on shared devices; answer-sheet records (Part B) with offline sync; progress views; badges; certificates and badge cards, singly and in bulk; the back-office People, Badges and Privacy modules; deleting data.

**Out of scope (later specs):** competitions and public leaderboards (they will reuse bulk certificates, §4.6); live help sessions; the AI helper (M6); WhatsApp parent questions; kit orders; recording robot-world runs (the run report stays on the device, as in M4); payments.

## 3. Users and journeys

**School or club admin (a teacher or coach who sets up the organisation)**
1. Registers the school or club once; the back office verifies the **organisation** (one check per school or club, not per teacher, §7.4).
2. Invites colleagues by email; they become teachers or coaches of that school or club with no further checks.

**Teacher or coach**
1. Creates a class (name, grade, language) and gets an **enrolment link and QR code** to share with parents: in the school's newsletter, WhatsApp group or on a printed notice. The teacher types no learner details.
2. Watches enrolments arrive; can rename a nickname that is unsuitable, move learners between their classes, and reset sign-in.
3. Sees the **progress grid** and prints certificates or badge cards for the class in one go.

**Parent or guardian**
1. Opens the enrolment link on their phone (a light page, in their language), creates a parent account (§4.1), and reads the notice of what is collected and why.
2. **Enrols the child:** the child's **name for certificates** (first name and surname, stored encrypted), grade, and a nickname for the app (suggested from the first name, changeable). Sets the **consent controls** (§4.2).
3. Can see and change their consent, see their child's progress and badges, correct the certificate name, and **delete** the child's profile at any time.
4. A family can also enrol a child with no school (homeschool), or into a **club or event** with the same link pattern.

**Learner**
1. Signs in on a shared device (class code, tap their nickname, picture PIN) or stays signed in on a family phone.
2. After a lesson, enters the **sheet code** from their paper answer sheet and ticks what the sheet shows (answer-sheets FR-B2), online or offline.
3. Sees lessons done, "Not yet" items to work on, and badges earned. Never sees other learners' records or anyone's real name, including their own (the app has no screen that shows it), and can't message anyone.

**Event organiser (competition manager in the back office, later competitions spec)**
1. Opens enrolment for an event; families enrol or link an existing learner profile with one tap.
2. After the event, generates **all certificates in one batch** (§4.6).

## 4. Functional requirements

### 4.1 Accounts, organisations and classes
| ID | Requirement |
|---|---|
| FR-1 | Adults sign up with email or mobile number and a one-time code (Supabase Auth, ADR-0010): parent/guardian, teacher, coach, school/club admin. One person may hold several roles. Back-office roles keep required MFA. |
| FR-2 | A **school** or **club** is registered once by its admin and verified once in the back office (§7.4). The admin invites teachers or coaches by email or mobile; invited staff need no separate verification. |
| FR-3 | A **class** has a name, grade band, language, one or more teachers or coaches, and an **enrolment link + QR code** (can be closed or renewed). A **class code** (6 letters, no vowels) is used for learner sign-in. |
| FR-4 | A **learner profile** has a nickname (unique in the class, 2–20 characters), grade, avatar, language, picture PIN, and an **encrypted certificate name** (§4.5). It belongs to the enrolling parent and can join several classes, clubs and events. |
| FR-5 | **No teacher data entry:** learners appear in a class only through their parent's enrolment, or when a parent links an existing profile. Teachers can rename a nickname, move or remove a learner, and reset sign-in. |

### 4.2 Online enrolment and consent controls
| ID | Requirement |
|---|---|
| FR-6 | Consent is given **online by the parent or guardian during enrolment**, after a plain-language notice in their language. There is no paper consent route (owner decision). |
| FR-7 | **Consent controls** (each recorded with the notice version and time, each changeable later in the parent's account): |
| | (a) *Learning record* (required to enrol): progress, sheet records and badges are kept for this child. |
| | (b) *Name on certificates* (optional, on by default only if the parent types a name): the child's name is stored encrypted and printed only on certificates and badge cards. Off: certificates print with a blank name line. |
| | (c) *Share with the class or club* (required per class): the class's teachers or coaches see the nickname and progress (never the name). |
| | (d) *Event results* (later competitions spec, optional): the nickname and school or club may appear in event results. |
| FR-8 | The enrolling adult confirms they are the child's parent or legal guardian (POPIA s35(1)(a), "competent person"). A second guardian can be added and has the same rights. |
| FR-9 | Withdrawing (a) deletes the learner's profile and records (§7.5). Withdrawing (b) deletes the stored name at once. Withdrawing (c) removes the child from that class. |
| FR-10 | A learner is visible to a class only after (a) and (c) are given. Nothing is recorded before consent. |

### 4.3 Progress (answer-sheets Part B)
| ID | Requirement |
|---|---|
| FR-11 | Answer-sheets FR-B1 to FR-B8 as approved: learners record their own sheets by sheet code; team sheets are recorded by each member; no free-text answers; "Not yet" never earns a badge. |
| FR-12 | Recording works **offline**: records are kept on the device (IndexedDB) and sent when a connection returns (ADR-0014). |
| FR-13 | On a shared device, each learner's unsent records are kept separately and sent under that learner only. |
| FR-14 | Teacher/coach **progress grid**: learners (by nickname) × lessons, with done, "Not yet", built and working, and checked. Filter by phase. |
| FR-15 | **Checking is optional, not a gate (changed for scale):** badges are awarded automatically from recorded sheets. A teacher can **spot-check** and mark records checked, and can **revoke** a badge or record that is wrong. A class or event can switch on "badges need a check" where the organiser wants it. |
| FR-16 | **Parent view:** their child's lessons, "Not yet" items and badges, in the parent's language. |

### 4.4 Badges
| ID | Requirement |
|---|---|
| FR-17 | Badge definitions are **content** (`content/badges/<id>.json` + `<id>.svg`), reviewed like seasons: a name and description (translated), artwork, and a rule. |
| FR-18 | First rules: complete a lesson (all steps, built and working); all "I can" checks "Yes"; complete N lessons of a phase; complete every lesson of a mechanism; Season 1 (finish the season's course for your grade band, recorded by the teacher or event organiser, since runs stay on the device in M5). |
| FR-19 | In the app, badges show with the **nickname** only. |

### 4.5 The certificate name: stored encrypted, seen only on the certificate
| ID | Requirement |
|---|---|
| FR-20 | The parent enters the child's **certificate name** (first name and surname as they should be printed) at enrolment, with consent control (b). It is the only real name in the system. |
| FR-21 | It is **encrypted before it reaches the database** (field-level encryption, §6.3). The database, its backups, the back office, Support staff and database administrators hold only ciphertext. |
| FR-22 | **It is never shown on a screen:** not in the class list, progress grid, learner app, back office, or on the print screens, which list nicknames only. The parent sees it once while typing it and can **replace** it (retype); it is not read back to them afterwards. |
| FR-23 | It is decrypted **only by the certificate service** (§6.2), only while producing a certificate or badge-card file for an adult allowed to print for that learner (§4.6), and only in memory. It is never logged, cached, emailed, sent to analytics or to any AI. |
| FR-24 | The produced file (PDF) is the only place the name appears. It is sent with `Cache-Control: no-store` and not kept on the server; the print screen offers **Print** and **Download**, and does not render a preview of the names. |
| FR-25 | Where control (b) is off or no name was given, that learner's certificate prints with a **blank name line**, in the same batch. |

### 4.6 Certificates and badge cards, singly and in bulk
| ID | Requirement |
|---|---|
| FR-26 | **Who can print:** the parent (their child), the learner's teachers or coaches (their class), and the event organiser (their event's participants). |
| FR-27 | **Bulk by design:** one action produces one PDF for a whole class, club or event: "every learner who earned badge X", "every participant of event Y", or a hand-picked set. Large batches (thousands) are produced in the background and offered as a download when ready; nobody types names. |
| FR-28 | A **certificate** (A4) shows: badge artwork and name, the learner's certificate name (or a blank line), the date, the school, club or event, the issuer's chosen display name, and a **verification code**. **Badge cards** (A6, four to a page) show the same in short. |
| FR-29 | The **verification code** (e.g. `RFA-7K3P-Q9`) can be checked by anyone at `/verify/`: it shows the badge, date and school, club or event, never the name or nickname. Codes are random and can be revoked. |
| FR-30 | Certificates are in the language chosen for the batch (default: the class or event language). Fixed text is interface words; badge names come from the badge's translations. |

## 5. Non-functional requirements
- **Public pages stay as they are:** lessons, templates and the code editor need no account and load no account code. Account code loads only on `/enrol/`, `/class/`, `/home/` and `/me/` pages, as Svelte islands, within a 120 KB compressed budget; the enrolment page within 60 KB (parents on prepaid data).
- **Scale:** an event of 5,000 learners can enrol in one day and get its certificates in one batch; the certificate service produces at least 20 certificates a second.
- **Offline:** a learner stays signed in for 30 days on a device; recording works offline (FR-12); teachers' class lists are cached for reading offline.
- **Shared, cheap phones:** a Grade 3 learner signs in in under 15 seconds; large tap targets; 360 px; learners type only the sheet code.
- **Languages and accessibility:** every screen, notice, badge and certificate goes through translation; WCAG 2.2 AA; picture PINs have text alternatives and a four-digit PIN fallback.

## 6. Technical architecture
### 6.1 Data model (Supabase Postgres, row-level security everywhere)
```
organisations(id, kind: school|club, name, province, verified_at)
adults(user_id → auth.users, display_name)                   -- the name an adult chooses to show
adult_roles(user_id, role: parent|teacher|coach|org_admin, organisation_id?)
classes(id, organisation_id?, name, grade_band, language, class_code, enrol_token, archived_at)
class_staff(class_id, user_id)
learners(id, nickname, grade, avatar, language, pin_hash, parent_user_id,
         certificate_name_ciphertext?, certificate_name_key_version?)
learner_guardians(learner_id, user_id)
class_learners(class_id, learner_id, consented_at)
consents(learner_id, user_id, control: record|name|class:<id>|event_results, notice_version,
         given_at, withdrawn_at)
sheet_records(learner_id, lesson_id, sheet_code, steps_done, i_can, built_working,
              team_sheet, recorded_at, checked_by?, checked_at?, revoked_at?)
badge_awards(learner_id, badge_id, awarded_at, rule_version, revoked_at?)
certificate_codes(code, badge_award_id, issued_for: class|event|parent, issued_by, issued_at, revoked_at)
```
The **certificate name** is the only real name, and only ever stored as ciphertext. No birth dates, ID numbers, photos, addresses or learner contact details anywhere. Adults' emails or mobile numbers live in Supabase Auth.

### 6.2 Where the pieces live
- Same Supabase project as the back office, separate tables and policies; learners are **not** Supabase Auth users (they have no email).
- `apps/web`: `/enrol/<token>/`, `/class/`, `/home/`, `/me/`, `/verify/` as Svelte islands calling Supabase with row-level security.
- **Two small Cloudflare Workers** (the ADR-0011 pattern; no service key in any browser):
  - **sign-in service:** checks class code + nickname + picture PIN (rate-limited) and issues a learner session;
  - **certificate service:** the only code that holds the name key; it checks the caller may print for those learners (§4.6), decrypts the names in memory, draws the PDF and streams it back.

### 6.3 Encrypting the certificate name (ADR-0015, to write)
- **Field-level, authenticated encryption** (AES-256-GCM, via the Workers' Web Crypto) with a random nonce per value; the learner's id is bound in as associated data, so a ciphertext can't be copied onto another learner.
- **Encrypt where it's typed:** the enrolment page sends the name only to the certificate service, which encrypts it and stores the ciphertext; the plain name never reaches Supabase or its logs.
- **The key lives only in the certificate service's secrets** (Cloudflare), never in the database, the repository, the back office or a browser. Key versions allow **rotation** (re-encrypt in the background); a leaked database dump alone reveals no names.
- Deleting a learner deletes the ciphertext; backups holding old ciphertext expire within 30 days.

### 6.4 Learner sign-in (ADR-0013, to write)
Class code → tap your nickname → a **picture PIN** (4 taps from a grid of 9, repeats allowed: 6,561 combinations; 5 tries then a 5-minute lock, teacher told). The session is a signed token for that learner only, kept on the device for 30 days. For events, organisers can print **QR sign-in cards** in bulk (no names on them, only the nickname and a QR code).

### 6.5 Offline progress (ADR-0014, to write)
A per-learner outbox in IndexedDB; records are idempotent (learner, lesson, sheet code, recorded_at), so sending twice changes nothing. Only the learner writes records; teachers write only check and revoke marks.

## 7. Security, privacy and child safety (POPIA)
### 7.1 What is collected and why
| Data | Why | Legal basis |
|---|---|---|
| Learner nickname, grade, avatar, language, picture PIN (hashed) | Sign in, show progress | Consent of a competent person (parent/guardian), POPIA s35(1)(a), control (a) |
| Sheet records, checks, badges | The record of learning | Same consent, control (a) |
| **Certificate name** (encrypted) | Printed on the child's certificates and badge cards | Separate consent, control (b); optional |
| Class membership | The class's teachers see progress | Consent, control (c) |
| Adult email or mobile, display name, role | Account, sign-in, consent records | Consent of the adult; terms of use |
| Organisation name, area | Group classes; verify organisations | Legitimate interest of the school or club |

**Not collected:** birth dates, ID numbers, photos, voice, location, addresses, learner contact details, free-text answers, tracking identifiers.

### 7.2 Security safeguards (POPIA s19)
- The certificate name is encrypted (§6.3) and seen only on the certificate (§4.5); every other learner field is minimal and shown only to the people consent allows.
- Row-level security on every table, tested on PGlite for every policy (as migrations 0001–0009).
- Service keys and the name key only in Workers' secrets; MFA for back-office roles; audit log for every back-office access to learner data and every certificate batch (who, when, how many; never the names).
- No paper consent forms to store, lose or secure (owner decision).

### 7.3 Child safety
- **No messaging** of any kind. Teachers see only their own classes, by nickname.
- Nicknames are checked for full names and rude words (per language); teachers can rename.
- Learners never see other learners' records, and no screen shows any real name.

### 7.4 Verifying organisations (scale)
The back office verifies each **school or club once** (official email domain, school phone number, or a registered organisation or library). Its admin then invites staff without further checks. Unverified organisations can run one trial class of up to 40 learners and can't print certificates.

### 7.5 Keeping and deleting data
- Withdrawn consent: (a) learner and records deleted within 7 days; (b) name deleted at once; (c) removed from that class at once.
- Archived class: learners in no other class are deleted **12 months** after the class is archived; the parent is told first.
- Parent "delete my child's profile": deleted at once; backups expire within 30 days.
- Adult accounts unused for 24 months: reminded, then deleted 30 days later.
- The back-office Privacy module handles access and deletion requests and keeps a breach log with the POPIA s22 notification steps.

### 7.6 Threat notes
| Threat | Mitigation |
|---|---|
| Database or backup leak | Names are ciphertext; the key is elsewhere (§6.3); other fields are minimal |
| Someone with database or back-office access reads names | They hold only ciphertext; only the certificate service decrypts, and only into a PDF |
| A teacher prints certificates for children not in their class | The certificate service checks class staff, guardianship or event roles for every learner in a batch; refused learners are listed by nickname |
| A name leaks through logs or caches | The service never logs names; responses are `no-store`; an automated test generates a certificate and searches every log line, network trace and browser store for the name |
| A stranger enrols a child they're not responsible for | Enrolment needs the class's link; the enrolling adult confirms guardianship; teachers see enrolments and can remove a learner; a second guardian can withdraw |
| Picture PIN guessed on a shared phone | Rate limit and lock; worst case, ticks on someone else's sheet, which teachers can revoke |
| A verification code reveals a child | It shows only badge, date and organisation or event |
| Large batch abused to harvest names | Batches only for the caller's own learners; every batch logged with count; organisers' accounts need MFA |

## 8. Acceptance criteria
- [ ] A teacher creates a class and shares the enrolment link; 30 parents enrol their children online with consent controls in English and isiZulu; the teacher types no learner details.
- [ ] Nothing is recorded for a learner before consent (a) and (c).
- [ ] The certificate name appears in no database column, log, network response other than the certificate PDF, or screen; an automated test checks the database, the Workers' logs and browser storage after enrolment and after printing.
- [ ] A class batch prints one PDF with each learner's name on their certificate; a learner whose parent turned off control (b) gets a blank line.
- [ ] A 5,000-learner event batch is produced in the background within 5 minutes.
- [ ] Rotating the name key re-encrypts every name, and certificates still print correctly.
- [ ] Withdrawing control (b) deletes the name at once; the next certificate prints with a blank line.
- [ ] Badges are awarded automatically from recorded sheets; a teacher revokes one and it disappears; "badges need a check" works where switched on.
- [ ] Two learners record sheets on one phone offline; each record arrives under the right learner.
- [ ] Row-level security tests: teacher ↔ other class, learner ↔ other learner, parent ↔ other child, organiser ↔ other event.
- [ ] `/verify/` shows badge, date and organisation, never a name or nickname.
- [ ] Public lesson pages load no account code; Lighthouse stays 90+.

## 9. Work plan for Claude Code
One PR per step; ⏸ marks a stop for review.
1. ⏸ **This spec** approved; then **ADR-0013** (learner sign-in), **ADR-0014** (offline records) and **ADR-0015** (encrypting the certificate name) for review.
2. **Database:** migrations for §6.1 with row-level security, consent controls and deletion; PGlite tests for every policy.
3. **Organisations and classes:** sign-up with email or mobile, organisation registration and one-time verification (back-office People module), staff invitations, classes with enrolment links and QR codes.
4. **Enrolment:** the enrolment page (light, translated), consent controls, the certificate-name encryption path through the certificate service; parent account page (consent changes, replace name, delete); back-office Privacy module.
5. **Learner sign-in and records:** the sign-in Worker, picture PIN, QR cards, `/me/`, answer-sheet recording offline with per-learner outboxes.
6. **Progress views:** the teacher/coach grid with spot-check and revoke; the parent view.
7. **Badges:** the badge format in content, the first badges, automatic awarding; back-office Badges module.
8. **Certificates:** the certificate service (decrypt in memory, PDF), single and bulk batches, background batches, verification codes and `/verify/`; the name-leak tests.
9. ⏸ **People checks** (test plan): enrolment by parents on cheap phones, sign-in with Grade 3 learners, a printed certificate batch at a school.

## 10. AI opportunities
None in M5. Nothing about learners, and never a name, goes to any AI (CLAUDE.md §7).

## 11. Revenue notes
Core stays free. Later paid add-ons this makes possible: school dashboards across classes, printed certificate packs for events, verified competition entries.

## 12. Risks
| Risk | Effect | Mitigation |
|---|---|---|
| Parents without data or a smartphone can't enrol | Child can't record progress (lessons still work) | Light, zero-rated enrolment page; enrolment can be done on any phone, including a relative's or the school's, by the parent themself |
| Misspelt names on certificates | Reprints | Parent types it; they can replace it before printing; the batch screen shows which learners have a name |
| The name key is lost | Names can't be decrypted | Key kept in Cloudflare secrets plus an offline copy in the owner's password-manager vault (like the break-glass account) |
| Large events overload the certificate service | Slow batches | Background batches, queued per event |

## 13. Owner decisions
**Decided (2026-11-24):** names stored encrypted and seen only on certificates and badges; online consent during enrolment with controls; no paper consent; avoid admin-heavy steps for large events.

**Still to confirm (recommendation first):**
1. **Consent controls** as in FR-7: (a) learning record required, (b) name optional, (c) per class, (d) event results later.
2. **Badges awarded automatically**, with optional spot-checks and revoke, and an optional "badges need a check" switch (replaces v0.1's required check mark).
3. **Organisations verified once**; their admin invites staff (replaces per-teacher verification).
4. **Learner sign-in:** picture PIN, plus printable QR cards for events.
5. **Parent sign-in:** email or mobile number with a one-time code.
6. **Retention:** delete learners 12 months after their class is archived.

## Version history
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft, including where certificate and badge names come from (owner request) |
| 0.2 | 2026-11-24 | Owner feedback: certificate name stored encrypted, seen only on the certificate; online enrolment with consent controls, no paper consent; built for large events (parent enrolment instead of teacher data entry, bulk certificates, automatic badges with spot-checks, one-time organisation verification) |
