# Spec: M5 — Family groups and personal learners

> **Version:** 0.3 · **Date:** 2026-11-25 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-25): §9 decisions 1, 3 and 4 as proposed; decision 2 changed (no "Self-recorded learning" wording)
> Builds on: `docs/specs/M5-teach.md` (accounts, consent, badges, certificates), ADR-0013 (learner sign-in), ADR-0015 (certificate names), CLAUDE.md §7 (POPIA).
> **Owner direction (2026-11-25):** homeschool families get a **family group**. Adults learning on their own are **personal learners**, and a personal learner is **not a group**.

## 1. Purpose

Today a learner can only be made through a school or club class link (M5 FR-5). Two kinds of people therefore can't record sheets, earn badges or get certificates, although the lessons, templates and code editor all work for them without an account:
- **homeschool families** (CLAUDE.md §1: "Parents and guardians, homeschool families");
- **adults learning on their own** (CLAUDE.md §1: "children and adult beginners").

## 2. Scope

**In:**
- the family group;
- the personal learner;
- how badges, the check switch and certificates treat both;
- consent;
- deletion;
- threat notes.

**Out:**
- **Groups led by an unverified adult for other people's children:** those stay clubs, which are verified (M5 §7.4).
- **A learner under 18 learning alone:** they come through a parent's family group, because POPIA needs a parent's consent.

## 3. User journeys

**Parent or guardian, homeschooling (family group)**
1. In **Your account**, they choose **Start a family group**. There's nothing to verify, because nobody outside the family can join.
2. They add their children:
   - a new child, with the same notice, consents and nickname form as parent enrolment (M5 FR-6 to FR-10);
   - or a child they already enrolled at a school or club (one profile per child, FR-31).
3. A child signs in on the family phone with the family group's code and their picture PIN, like any class. On a parent's own phone, the parent can also tap **Learn as Thandi** to sign the child in.
4. The child records their answer sheets. Badges are earned from them, and the parent sees progress and badges as in Your children.
5. A second parent or guardian can be **invited** by a one-time link (as staff invitations, M5 step 3d). They become a guardian of the group's children only after the first parent confirms.

**Adult learning alone (personal learner)**
1. In **Your account**, they choose **I'm learning myself**. They confirm they are **18 or older**; no birth date is collected. They read the notice and give their own consent.
2. This adds **their own learner profile** to their account: a nickname and picture, and optionally their name for certificates. It is not a group: there is no code, no list of members and nobody else in it.
3. They record sheets straight from their account on their own phone. No picture PIN is needed, because they're already signed in with their emailed code.
4. They can also join a real class with its enrolment link (an evening club, for example). There, that class's coach sees their progress and can check their sheets, like anyone else's.

## 4. Requirements

### 4.1 Family group
| ID | Requirement |
|---|---|
| FF-1 | A family group belongs to the parent who made it. **No verification**: it is not listed to the back office's verifiers and gets no "not yet verified" mark. |
| FF-2 | **Only that family's children:** a child joins only if the parent adding them is the child's guardian. There is **no enrolment link, QR code, school enrolment, staff invitation or QR sign-in cards**, so a family group can't be used to run a club. |
| FF-3 | **At most 8 children** (owner decision). More than that is a club. |
| FF-4 | Learners sign in with the group's **code and picture PIN** as in a class (ADR-0013). Optionally, **Learn as <child>** on a parent's signed-in phone gives the child a session through the sign-in service without the PIN. |
| FF-5 | **No check switch:** nobody in a family group is an independent checker, so records are **self-recorded** and the "badges need a check" switch isn't offered. Parents can't mark records checked. |
| FF-6 | **The stricter class still wins** (owner decision): if the child is also in a school or club class with the switch on, their badges wait for that teacher's or coach's check. |
| FF-7 | **A second guardian** joins by a one-time invitation link that the first parent confirms. Each guardian has the same rights over the children: consent, progress, deletion. |
| FF-8 | **Ending the group:** the parent can end it at any time. The children stay with their parent (and any other classes) under M5 §7.5. |

### 4.2 Personal learner
| ID | Requirement |
|---|---|
| FP-1 | A personal learner is **an adult's own learner profile on their own account**, not a group or class. One per adult. |
| FP-2 | **18 or older:** the adult ticks "I am 18 or older"; no birth date is stored. Someone under 18 is turned to a parent (family group). |
| FP-3 | **Own consent:** the adult consents for themselves to records (a) and to the certificate name (b). Consent (c), sharing with a class, is given when they join a class. |
| FP-4 | **Recording from their account:** sheets are recorded from Your account with their adult session. No class code or picture PIN is needed, and records use the same table and rules (`sheet_records`, outbox, offline). |
| FP-5 | **Badges:** self-recorded, like a family group. If they join a class with the switch on, the stricter class wins (FF-6). |
| FP-6 | **Their own name on certificates:** an adult may give their full name for their certificates (it's their own data). It's stored encrypted, the same as children's names (ADR-0015). |
| FP-7 | **Deletion:** deleting the adult account deletes their learner profile. Dormancy rules apply as for any adult (M5 §7.5). |

### 4.3 Certificates and verification
| ID | Requirement |
|---|---|
| FC-1 | **No "self-recorded" wording (owner decision):** where a school or club certificate names the school or club, a certificate from a family group or a personal learner says **"Awarded by Robots For All"**. `/verify/` shows the same: the badge, the date and "Awarded by Robots For All". |
| FC-2 | A certificate whose records were **checked** by a school or club teacher or coach names that school or club, whoever recorded them. |

## 5. Data (what changes)
- **`organisations.kind`** gets `family`. A family "organisation" has one class and one owner, `verified_at` stays null, and no verification is offered. *(Alternative: a separate `family_groups` table. I recommend reusing classes, so sign-in, records, progress and badges work unchanged.)*
- **Personal learners:** `learners.self_user_id` (nullable), set when the profile is an adult's own. The adult is also its guardian, so every existing rule (`is_guardian`) holds. A check makes sure an adult has at most one.
- **No new personal data** beyond what M5 already collects. The 18+ tick is stored only as the notice version consented to.

## 6. Acceptance criteria
- A parent starts a family group, adds two children (one new, one already at a school), and each child signs in on the family phone and records a sheet. Badges are awarded self-recorded. A ninth child is refused.
- A family group offers no enrolment link, QR code, cards, check switch or staff invitation, and a parent can't mark a record checked.
- An adult adds "I'm learning myself", records a sheet from their account offline, earns a badge, and gets a certificate saying "Awarded by Robots For All"; `/verify/` shows the badge, the date and the same words.
- A child in a family group and a school class with the switch on gets badges only after the teacher checks.
- Deleting the parent's account follows M5 §7.5. Deleting an adult's account deletes their learner profile.

## 7. Threat notes
- **Running an unverified club as a "family":** prevented by guardians-only membership, the 8-child cap, and no links, QR codes or cards. The back office can see family groups by count (not names) to spot misuse.
- **Self-recorded badges and certificates presented as checked ones:** with no "self-recorded" wording (owner decision), such a certificate says **"Awarded by Robots For All"** in place of a school or club, and `/verify/` shows the same, so a school-checked certificate is still told apart by naming its school or club. The verification code proves the badge was awarded.
- **A child posing as an adult:** the 18+ tick is a declaration, not proof. The honest limit is that it collects no more data. A personal learner is never in a class without that class's teacher or coach seeing them, and nothing in the product lets adults and children message each other (CLAUDE.md §7).
- **"Learn as <child>":** it only works on the guardian's own signed-in session, so it exposes nothing beyond what the guardian can already see.
- **Second guardian:** the one-time link plus the first parent's confirmation stop anyone with a forwarded link from becoming a guardian on their own.

## 8. Work plan (each its own PR, after approval)
1. Database: the `family` kind, the cap, guardians-only membership, `self_user_id`, and the second guardian. PGlite tests.
2. Family group pages in Your account; "Learn as <child>" through the sign-in service.
3. Personal learner: "I'm learning myself", recording from Your account.
4. With certificates (M5 step 8): family and personal certificates say "Awarded by Robots For All" (FC-1).

## 9. Owner decisions (2026-11-25)
1. **The cap:** yes, at most 8 children per family group.
2. **Wording:** changed. There is **no "Self-recorded learning" wording**; family and personal certificates say **"Awarded by Robots For All"** where a school certificate names the school (FC-1).
3. **"Learn as <child>"** on a parent's own phone: yes.
4. **A second guardian** by invitation: yes.

## Version history
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-25 | First draft (owner: family group yes; a personal learner is not a group) |
| 0.2 | 2026-11-25 | Approved: cap 8, "Learn as <child>", second guardian; no "Self-recorded learning" wording (family and personal certificates name no organisation) |
| 0.3 | 2026-11-25 | Owner: family and personal certificates say "Awarded by Robots For All" in place of a school or club name |
