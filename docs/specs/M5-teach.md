# Spec: M5 — Teach (enrolment, classes, progress, badges and certificates)

> **Version:** 0.5 · **Date:** 2026-11-25 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-24; v0.5 changes approved 2026-11-25): the recommendations, with the owner's changes below (§13)
> Builds on: answer-sheets spec Part B (approved in principle), back-office spec (People, Badges, Privacy modules), ADR-0010 (accounts and roles), CLAUDE.md §7 (POPIA).
> **Owner direction (2026-11-24):** (1) learners' names may be stored, **encrypted**, as POPIA allows with proper security safeguards; a name is never seen on screen while printing, only on the printed certificate or badge; (2) parents give consent **online during enrolment**, with controls; no paper consent, because securing signed paper is its own POPIA problem; (3) avoid admin-heavy steps that don't work for **large-scale events**.
> **Owner decisions (2026-11-24, second round):** children under 18 are enrolled by their **school, club or parent**; when a school or club enrols, a **parent confirms online** with a one-time code sent by **WhatsApp, SMS or email**; badges (images) and certificates (PDFs) are **fully automated**; data is **deleted as soon as it is no longer needed**; the owner asked how schools are verified (§7.4) and about an **ID for life** (§4.7).

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
1. Creates a class (name, grade, language). Then either:
   - **the school or club enrols the class:** uploads its class list (a spreadsheet: learner's name, grade, and a parent's mobile number or email), or adds learners one by one. Each parent gets a **confirmation request** by WhatsApp, SMS or email (§4.2); or
   - **parents enrol:** the teacher shares an **enrolment link and QR code** (newsletter, WhatsApp group, printed notice) and types nothing.
2. Watches enrolments arrive; can rename a nickname that is unsuitable, move learners between their classes, and reset sign-in.
3. Sees the **progress grid** and prints certificates or badge cards for the class in one go.

**Parent or guardian**
1. Either opens the class's enrolment link, or receives the school's or club's **confirmation request** by WhatsApp, SMS or email. Either way they sign in with a **one-time code** sent to their mobile (WhatsApp or SMS) or email, and read the notice of what is collected and why, in their language.
2. **Enrols or confirms the child:** the child's **name for certificates** (first name and surname, stored encrypted; already filled in if the school entered it, and the parent can correct it), grade, and a nickname for the app (suggested from the first name, changeable). Sets the **consent controls** (§4.2).
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
| FR-1 | Adults sign in with a **one-time code** sent by **WhatsApp, SMS or email**, whichever they choose (Supabase Auth phone/email OTP, ADR-0010; WhatsApp and SMS through a message provider, §6.2): parent/guardian, teacher, coach, school/club admin. One person may hold several roles. Back-office roles keep required MFA. |
| FR-2 | A **school** or **club** is registered once by its admin and verified once in the back office (§7.4). The admin invites teachers or coaches by email or mobile; invited staff need no separate verification. |
| FR-3 | A **class** has a name, grade band, language, one or more teachers or coaches, and an **enrolment link + QR code** (can be closed or renewed). A **class code** (6 letters, no vowels) is used for learner sign-in. |
| FR-4 | A **learner profile** has a nickname (unique in the class, 2–20 characters), grade, avatar, language, picture PIN, and an **encrypted certificate name** (§4.5). It belongs to the child's parent or guardian (whoever enrolled the child), and can join several classes, clubs and events over the years (§4.7). |
| FR-5 | **Three ways in (owner decision):** a child under 18 is enrolled by (1) their **parent** through a class or event link; (2) their **school**; or (3) their **club**. Schools and clubs enrol by **uploading a class list** (name, grade, parent's mobile or email) or adding learners one by one; the names are encrypted on arrival (§6.3). |
| FR-5a | A learner enrolled by a school or club is **pending until a parent confirms online** (FR-6). A pending learner holds only what is needed to ask: the encrypted name, grade, class and the parent contact. If no parent confirms within **14 days** (two reminders), the pending learner and the parent contact are **deleted**. |
| FR-5b | If the parent already has a learner profile for this child (from another school, club or event), confirming **links** the existing profile instead of making a second one. |
| FR-5c | Teachers can rename a nickname, move or remove a learner, and reset sign-in; they never see the certificate name. |

### 4.2 Online enrolment and consent controls
| ID | Requirement |
|---|---|
| FR-6 | Consent is always given **online by the parent or guardian**, signed in with a one-time code (WhatsApp, SMS or email), after a plain-language notice in their language: while enrolling the child themself, or when confirming the school's or club's enrolment. There is no paper consent route (owner decision). |
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
| FR-19a | **Fully automated (owner decision):** when a rule is met, the badge is awarded, its **badge image** appears in the learner's profile, and its **certificate PDF** becomes available, without anyone pressing a button. The parent is told by their chosen channel ("Rocket earned the Crank badge") with a link to sign in and download; the message itself never contains the child's name or the certificate. |

### 4.5 The certificate name: stored encrypted, seen only on the certificate, the badge and the teacher's console
| ID | Requirement |
|---|---|
| FR-20 | The parent enters the child's **certificate name** (first name and surname as they should be printed) at enrolment, with consent control (b). It is the only real name in the system. |
| FR-21 | It is **encrypted before it reaches the database** (field-level encryption, §6.3). The database, its backups, the back office, Support staff and database administrators hold only ciphertext. |
| FR-22 | **Where it appears (owner decision, 2026-11-25):** only on (1) the printed or downloaded **certificate**, (2) a **badge** card or image where the badge design needs it, and (3) the **teacher's console**, for the class's own teachers and coaches, on request (FR-22a). Never in the learner app, the progress grid by default, the back office, Support screens, messages, logs or AI. The parent sees it while typing it and can **replace** it (retype); it is not read back to them afterwards. |
| FR-22a | **Teacher's console, "Show names":** a class's teachers and coaches (of a **verified** school or club) can tap **Show names** on their class list. The certificate service decrypts that class's names and returns them for that screen only: shown next to the nicknames, never stored in the browser (no local storage, no cache, `no-store`), hidden again after **2 minutes** or on leaving the page. It needs a sign-in within the last **12 hours**. Every reveal is recorded (who, which class, when, how many names; never the names). The parent's consent wording (control b) says the class's teachers can see the name. |
| FR-23 | It is decrypted **only by the certificate service** (§6.2), only while producing a certificate or badge file for an adult allowed to print for that learner (§4.6) or answering a teacher's **Show names** (FR-22a), and only in memory. It is never logged, cached, emailed, sent to analytics or to any AI. |
| FR-24 | Apart from the teacher's console (FR-22a), the produced file (PDF or badge image) is the only place the name appears. It is sent with `Cache-Control: no-store` and not kept on the server; the print screen offers **Print** and **Download**, and does not render a preview of the names. |
| FR-25 | Where control (b) is off or no name was given, that learner's certificate prints with a **blank name line**, in the same batch. |

### 4.6 Certificates and badge cards, singly and in bulk
| ID | Requirement |
|---|---|
| FR-26 | **Who can print:** the parent (their child), the learner's teachers or coaches (their class), and the event organiser (their event's participants). |
| FR-27 | **Automated and in bulk:** each certificate is produced automatically when its badge is awarded (FR-19a). Teachers, coaches and organisers can also download a whole class, club or event in one PDF ("every learner who earned badge X", "every participant of event Y"); large batches (thousands) are produced in the background, and an event's batch is ready automatically when the event closes. Nobody types names. |
| FR-28 | A **certificate** (A4) shows: badge artwork and name, the learner's certificate name (or a blank line), the date, the school, club or event, the issuer's chosen display name, and a **verification code**. **Badge cards** (A6, four to a page) show the same in short. |
| FR-29 | The **verification code** (e.g. `RFA-7K3P-Q9`) can be checked by anyone at `/verify/`: it shows the badge, date and school, club or event, never the name or nickname. Codes are random and can be revoked. |
| FR-30 | Certificates are in the language chosen for the batch (default: the class or event language). Fixed text is interface words; badge names come from the badge's translations. |

### 4.7 One learner profile for life, kept only while it is needed (owner question)
| ID | Requirement |
|---|---|
| FR-31 | A child has **one learner profile** that follows them from class to class, school to school, club and event, so badges and certificates build up over the years. Schools and clubs **link to** it (FR-5b); they don't own it. The family does. |
| FR-32 | The profile's ID is an internal random number. It is never shown, printed or used as an identifier outside the system (no national ID or learner number from the school is stored). |
| FR-33 | **It lasts only while it is needed:** while the child is in a class, club or event, or the parent's account is in use. When none of these holds (§7.5), it is deleted. "For life" means "as long as the family wants it", not "forever". |
| FR-34 | **At 18** the learner can take over the profile with their own mobile or email and give their own consent; the parent's access ends. If nobody takes it over, it is deleted as in §7.5. |
| FR-35 | Before deletion the parent can **download** the child's badges and certificates (a PDF portfolio), so the record outlives the data we keep. Verification codes stay checkable after deletion: they show only the badge, date and organisation, which are not personal data. |

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
pending_enrolments(id, class_id, certificate_name_ciphertext, grade, parent_contact_ciphertext,
                   requested_at, reminders_sent, expires_at)   -- deleted on confirmation or after 14 days
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
- **Email first (owner decision, 2026-11-25):** until the WhatsApp and SMS provider is chosen, parent confirmation requests (FR-5a) and dormancy warnings (§7.5) go **by email only**. A school or club enrolling a child gives the parent's email address; it is kept encrypted (like the name) until the parent confirms, then deleted. Supabase's built-in mailer is for testing only (a few emails an hour), so live email needs an email (SMTP) provider set in Supabase (owner action 5).
- **Messages (WhatsApp, SMS, email):** one-time codes, confirmation requests and badge notices go through a message provider (WhatsApp Business Platform and SMS through a South African provider; email through Supabase's mailer). Messages carry no child's name and no certificate. Choosing the provider is an owner action (cost per message, and POPIA s72 for any provider outside South Africa; ADR-0016).
- **Two small Cloudflare Workers** (the ADR-0011 pattern; no service key in any browser):
  - **sign-in service:** checks class code + nickname + picture PIN (rate-limited) and issues a learner session;
  - **certificate service:** the only code that holds the name key; it checks the caller may print for those learners (§4.6), decrypts the names in memory, draws the PDF and streams it back.

### 6.3 Encrypting the certificate name (ADR-0015, to write)
- **Field-level, authenticated encryption** (AES-256-GCM, via the Workers' Web Crypto) with a random nonce per value; the learner's id is bound in as associated data, so a ciphertext can't be copied onto another learner.
- **Encrypt where it's typed:** the enrolment page sends the name only to the certificate service, which encrypts it and stores the ciphertext; the plain name never reaches Supabase or its logs.
- **The key lives only in the certificate service's secrets** (Cloudflare), never in the database, the repository, the back office or a browser. Key versions allow **rotation** (re-encrypt in the background); a leaked database dump alone reveals no names.
- **One key for all names, not one per name** (owner question, 2026-11-25): each name still gets its own random nonce and is bound to its learner, so no two ciphertexts are alike and none can be moved to another child. A key per name would only help if those keys were kept somewhere separate from the database; it adds a second store to secure and back up for little gain, so it is not used.
- **Vaulted:** the key is a Cloudflare **secret** on the certificate service (encrypted by Cloudflare, write-only: nobody can read it back, not even the owner). Two offline copies: the owner's password-manager vault and a sealed copy held by a second trusted person, so losing one never loses the names. A new key version each year (or at once if a leak is suspected); old names are re-encrypted in the background.
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
| **Pending school/club enrolment:** the child's name (encrypted), grade, class and a parent's mobile or email, entered by the school or club | Only to ask the parent to confirm; deleted after 14 days if they don't | The school's or club's own relationship with the family; processed by us on its behalf as operator (POPIA s20–21, an operator agreement in the organisation's terms) until the parent consents |
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

### 7.4 Verifying organisations: how (owner question)
Each **school or club is verified once**; its admin then invites staff without further checks. Unverified organisations can run one trial class of up to 40 learners and their certificates carry "not yet verified".

**Schools** (public and independent):
1. The admin registers with the school's **EMIS number** (the Department of Basic Education's school number). The back office looks it up in the **DBE master list of schools** (public), which gives the official name, province, district and the school's **official phone number** and address.
2. **Confirmation, any one of:**
   - a code sent to the school's **official email** (a `@<school>.<province>.school.za` or the school's own domain), or
   - a **call to the official phone number** from the DBE list, where the principal or office confirms the admin works there, or
   - a **letter on the school's letterhead signed by the principal**, emailed from the school's official address.
   - **Schools without email (owner note):** the call to the DBE-listed number is enough; or the principal sends the signed letter as a **WhatsApp photo from the school's phone or the principal's number**, and the back office confirms it by calling the DBE-listed number. The photo is looked at and **not kept**: the back office records only "letter seen, confirmed by phone on <date>".
3. The back office records which check was used, by whom and when (no copies of IDs). The school's admin is then verified.

**Registered clubs and others** (libraries, NPOs, community centres, companies running clubs):
1. A **registration number** checked against a public register: the NPO register (Department of Social Development), CIPC (companies), or the municipality for libraries and community centres.
2. Plus confirmation by its **official email or phone** from that register, or a letter from a verified school or partner organisation it works with.

**Unregistered clubs** (owner note: many community clubs aren't registered), any one of:
1. **Vouched for by a verified organisation** it works with or meets at (a school, library, church hall, community centre or partner NPO): that organisation's admin confirms in the back office, or by phone.
2. **Two community references** (for example a principal, ward councillor, faith leader, librarian or a verified coach), each confirmed by a phone call from the back office.
3. A **verification call** with the club lead (video if possible) about where and when the club meets and who helps run it, plus one reference as in 2.

The back office records only which route was used, who confirmed and when; no ID copies. Unregistered clubs are re-confirmed **every year** (registered ones every two years), and a club that vouched-for organisations stop vouching for loses verification until it is confirmed again.

**Event organisers** are back-office competition managers (already verified staff) or verified schools and clubs.

Re-checks: a verified school or registered club is re-confirmed every two years (unregistered clubs every year), or at once if a report is made.

### 7.5 Keeping and deleting data: delete as soon as it is no longer needed (owner decision, POPIA s14)
Each piece is deleted when its reason ends, not on a fixed calendar:
- **Pending school/club enrolment not confirmed:** deleted after 14 days (FR-5a).
- **Consent withdrawn:** (a) the learner and records are deleted at once; (b) the name is deleted at once; (c) the child leaves that class at once.
- **A class ends:** the class and its staff links are deleted when it is archived; learners stay only if they are in another class, club or event, or the parent's account is in use.
- **Dormant accounts (owner decision):** an account nobody has signed in to for **10 months** is sent a message **every 30 days** (at 10 and 11 months, by the adult's chosen channel: WhatsApp, SMS or email) saying it will be **deleted at 12 months of dormancy**, with a link to sign in to keep it and, for parents, to download the portfolio (FR-35). Signing in at any time stops the countdown. Warnings go **by email** until the WhatsApp and SMS provider is chosen. At **12 months** it is **due for deletion**, and is deleted **once confirmed in the back office** (owner decision, 2026-11-25): each day a job lists the due accounts under **Privacy → Due for deletion** (account type; the **name of what it is linked to**, i.e. the school or club name, or the adult's chosen display name for a parent, teacher or coach; last sign-in; how many learners would go; never a child's name or anyone's contact details). A privacy officer or the Information Officer confirms the list (one tap for the whole list, or untick an account to keep it with a reason, e.g. a complaint under way); confirming deletes them and records the count in the audit log. Unconfirmed lists are flagged on the back-office home and emailed to the Information Officer after 7 days. **If an account is not confirmed within 30 days, it is locked for 30 days** (owner decision, 2026-11-25): nobody can sign in to it and its learners can't sign in or record (the sign-in screen says the account is locked and how to ask for it to be kept); the back office is notified **every 7 days** while it is locked, and can unlock it (keep) or confirm early. At the end of the lock it is **deleted**. Deletion:
  - a **parent account**: with it, every learner profile it holds that is in no current class, club or event (learners still in a class stay, linked to the class only, until the class ends);
  - a **teacher, coach or organisation admin account**: their classes pass to another staff member of the same organisation, or are archived and deleted under the class rule if there is none.
- **No longer needed:** a learner who is in no class, club or event and whose parent's account is gone or dormant is deleted with the parent account as above.
- **Turning 18:** if nobody takes the profile over within 3 months (FR-34), it is deleted.
- **Parent "delete my child's profile":** deleted at once.
- The other rules above (consent withdrawn, a parent's delete, unconfirmed school enrolments after 14 days) are acted on at once, without confirmation.
- **Backups** holding deleted data expire within 30 days; names in backups are ciphertext anyway.
- **What stays:** verification codes (badge, date, organisation: not personal data) and counts for reports, with nothing linking them to a child.
- The back-office Privacy module records access and deletion requests and keeps a breach log with the POPIA s22 notification steps.

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
- [ ] A school uploads a class list of 40; each parent gets a WhatsApp, SMS or email request, confirms with a one-time code, and can correct the name; unconfirmed learners are deleted after 14 days.
- [ ] A child enrolled at a school and later a club keeps one profile: the club's enrolment links to it after the parent confirms.
- [ ] A badge awarded automatically gives a badge image in the profile and a certificate PDF ready to download, and the parent's notice contains no name.
- [ ] An account with no sign-in for 10 months gets a message at 10 and 11 months; signing in stops it; otherwise it is deleted at 12 months with its learners that are in no class, and their verification codes still check out.
- [ ] A school without email is verified by a phone call to its DBE-listed number; an unregistered club by a vouching organisation or two phone-confirmed references.
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
1. ✅ *(spec approved 2026-11-24; ADR-0013 to 0016 accepted 2026-11-25, message provider still to choose)* **This spec** approved; then **ADR-0013** (learner sign-in), **ADR-0014** (offline records) and **ADR-0015** (encrypting the certificate name) for review.
2. ✅ *(built 2026-11-25: migration `0010_teach.sql`, 22 PGlite tests)* **Database:** migrations for §6.1 with row-level security, consent controls and deletion; PGlite tests for every policy.
3. *(3a built 2026-11-25: back office People → Organisations, verify once by a fitting route; 3b built 2026-11-25: `/account/` sign-in with an emailed code, the `/db/` proxy (ADR-0017), the "accounts" site switch, off until the owner opens it; 3c built 2026-11-25: register a school or club, make classes, each with its class code, enrolment link (copy, WhatsApp share) and QR code via `qrcode-generator` 2.0.4 (MIT, no dependencies, about 15 KB gzip, loaded only when a class is opened); 3d built 2026-11-25: staff join by a one-time invitation link the admin shares (WhatsApp or email); no invitee email or phone is stored and we send nothing; migration 0011)* **Organisations and classes:** one-time-code sign-in by WhatsApp, SMS or email (provider chosen, ADR-0016), organisation registration with EMIS or register numbers and one-time verification (back-office People module), staff invitations, classes with enrolment links and QR codes.
4. *(Next, in this order, each its own PR: **4b** school and club enrolment with email confirmation; **4d** the certificate service: the name key, the parent adding or replacing the name, and the teacher's Show names *(built 2026-11-25: `apps/cert` Worker on `/cert/`, migration 0013)*; **4e** dormancy warnings by email and the back-office Due for deletion screen. Certificates and badge files themselves come in step 7.)* *(4a built 2026-11-25: `/enrol/#<token>`: a parent signs in with an emailed code, reads what is kept and why (notice version 1.0), ticks that they are the parent or guardian and the two required consents (records; sharing with this class), and enrols the child by nickname, grade, picture and language, or adds a child they already enrolled (`link_child`); full-looking names are refused as nicknames; the certificate name comes with the certificate step; 4c built 2026-11-25: "Your children" on `/account/`: each child's classes (migration 0012, `my_children_classes`, since parents can't read classes), take a child out of a class, save a copy of everything kept as a JSON file (POPIA s23), delete the profile after a warning)* **Enrolment:** parent enrolment by link; school and club enrolment by class list with parent confirmation requests; consent controls; the certificate-name encryption path; linking an existing profile; parent account page (consent, correct name, portfolio download, delete); automatic deletion jobs; back-office Privacy module.
5. **Learner sign-in and records:** the sign-in Worker, picture PIN, QR cards, `/me/`, answer-sheet recording offline with per-learner outboxes.
6. **Progress views:** the teacher/coach grid with spot-check and revoke; the parent view.
7. **Badges:** the badge format in content, the first badges, automatic awarding with badge images and parent notices; back-office Badges module.
8. **Certificates:** the certificate service (decrypt in memory, PDF), automatic certificates on award, class and event batches in the background, verification codes and `/verify/`; the name-leak tests.
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
**Decided (2026-11-24):**
- Names stored encrypted and seen only on certificates and badges; consent online with controls; no paper consent; nothing admin-heavy for large events.
- The recommendations: the consent controls of FR-7; automatic badges with optional spot-checks; organisations verified once; picture PIN plus QR cards for events; one-time-code sign-in; delete when no longer needed.
- Children under 18 are enrolled by their **school, club or parent**; school and club enrolments need a **parent's online confirmation** by one-time code over **WhatsApp, SMS or email**.
- **Badges (images) and certificates (PDFs) are fully automated.**
- **Delete as soon as it is no longer needed** (§7.5), with one learner profile per child for as long as the family wants it (§4.7).

**Decided (2026-11-25):**
- School and club enrolment confirmations go **by email only** for now; dormancy warnings likewise.
- The certificate name may also appear on a **badge** (if the design needs it) and on the **teacher's console** (FR-22a).
- **One key for all names**, kept in a Cloudflare secret and vaulted offline (§6.3).
- Dormant accounts are deleted **after confirmation in the back office**; the list shows the school, club or adult's display name each account is linked to; an account not confirmed within 30 days is **locked for 30 days**, with a back-office notice every 7 days, **then deleted** (§7.5).

**Owner actions:**
1. Choose the WhatsApp and SMS provider (cost per message; where it stores data, POPIA s72); ADR-0016 records the choice.
2. Confirm the reading of "ID for life" in §4.7: one profile per child that follows them across schools, clubs and events, kept while needed, taken over by the learner at 18, with a downloadable portfolio.
3. Before switching **accounts** on (Site settings): update the privacy page (it says there are no accounts) with what M5 collects (§7.1), and set the Pages secrets (docs/deploy.md).
4. Name the Information Officer (POPIA s55) for Robots For All, and register them with the Information Regulator before M5 goes live.
5. Choose an email (SMTP) provider for Supabase, so confirmation requests and warnings reach parents (cost, and POPIA s72 if it stores data outside South Africa).
6. Make the name key (docs/deploy.md will give the one command) and put the two offline copies in the vault.

## Version history
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft, including where certificate and badge names come from (owner request) |
| 0.2 | 2026-11-24 | Owner feedback: certificate name stored encrypted, seen only on the certificate; online enrolment with consent controls, no paper consent; built for large events (parent enrolment instead of teacher data entry, bulk certificates, automatic badges with spot-checks, one-time organisation verification) |
| 0.4 | 2026-11-24 | Owner notes: schools without email (phone, or a WhatsApp photo of the principal's letter confirmed by phone and not kept); unregistered clubs (vouching organisation, references, verification call; yearly re-check); dormant accounts warned every 30 days from 10 months and deleted at 12 months |
| 0.3 | 2026-11-24 | Approved with owner changes: enrolment by school, club or parent, with parent confirmation by one-time code over WhatsApp, SMS or email; badges and certificates fully automated; how schools and clubs are verified (EMIS number and DBE list, public registers); delete when no longer needed; one profile per child for as long as needed (§4.7) |
| 0.5 | 2026-11-25 | Owner decisions: email-only confirmations and warnings for now; the name may appear on a badge and on the teacher's console (Show names, FR-22a); one vaulted key for all names; dormant-account deletion confirmed in the back office, the list naming the linked school, club or adult, unconfirmed accounts locked for 30 days with weekly back-office notices, then deleted (approved 2026-11-25) |
