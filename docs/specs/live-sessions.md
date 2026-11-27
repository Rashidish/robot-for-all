# Spec: Live help sessions (virtual classroom)

> **Version:** 0.5 · **Date:** 2026-11-27 · **Owner:** Rashid Ishmail · **Status:** Approved (owner, 2026-11-27)
> Milestone: *Later* (after M6 AI helper). Depends on: M3 (block editor, program JSON), M5 (accounts, classes, roles, learner sign-in), back office (coach verification, reports). Proposes ADR-0019 (video stack). Keep the version line current; log changes at the bottom.

---

## 1. Purpose

Learners, parents and teachers get stuck on builds and code. **Live help sessions** let a verified volunteer coach run a scheduled group session for a lesson or grade, showing the build on camera and the code in the editor while learners watch, ask questions and follow along.

**Owner decisions this spec builds on (2026-11-22):**
- Priority is **live group help sessions** per lesson or grade, for schools, parents and learners. A solo-learner virtual classroom stays on the bucket list.
- Run by **verified volunteer coaches**.
- **Coach camera on, learners' cameras off.**
- During a session the coach can:
  - **show block code**
  - turn an **overhead or desk camera** on or off
  - **switch to or add** a camera view from their own device (laptop, tablet or phone)
  - show **2 or more camera views at once**
- **Learners choose what they receive, and the server adapts each learner's stream.** These two options work together (§6).
- **Each option can be toggled on and off** (owner, 2026-11-22), so we can **cut cost** when needed and **test** each option alone and together to see what it really saves (§4a).
- **Extra cameras** can come from an **old phone joined by QR code** or a **USB webcam**. Both must be supported.

**Owner decisions (2026-11-27):**
- **Spec approved**, with the screen sketches on the build-plan board (§7).
- The **coach may use a tablet** as the studio, not only a laptop (§7).

**Reality check that shapes this spec:** video is the most expensive thing on the platform, for learners (mobile data) and for us (server traffic). Each extra camera the coach adds must cost learners nothing unless they choose to watch it. Code is never sent as video.

---

## 2. Scope

### In scope
1. **Scheduled sessions** tied to a lesson, grade or class, with a join page, waiting room and attendance.
2. **Coach studio** on a laptop or tablet:
   - several camera sources at once (device cameras, USB/desk camera, phone joined by QR), each turned on or off separately;
   - choose the **main view** and optional **extra views**;
   - mic;
   - share block code.
3. **Live code sharing**: the coach's editor state (program JSON, M3) is streamed as data. Learners see it in a read-only copy of the editor and can **"Copy to my programs"**.
4. **Learner view**:
   - one main view by default;
   - tap to **swap** views or **add** a second one (picture-in-picture or side by side);
   - **Data saver** and **Audio + code only** modes.
5. **Adaptive streaming**: each camera is sent in several quality levels, and each learner receives only the views they've chosen, at the quality their connection can handle.
6. **Interaction without learner video**: raise hand, moderated text Q&A, and the coach can unmute a learner's microphone (mic off by default).
7. **Safeguarding controls**: verified coaches only, enrolled learners only, waiting room, an optional second adult, view-only observers, reporting, and session logs (§8).
8. **Reminders** through in-platform notices, plus optional WhatsApp Business reminders to parents (opt-in, with no session content and no learner data).

### Out of scope (later)
- Recording and replays (off for now).
- Solo-learner virtual classroom (bucket list).
- Breakout rooms.
- Learner screen sharing and learner video.
- Interactive whiteboard.
- Live translation and captions (wired for later).
- Using sessions for competitions.

---

## 3. Users and journeys

**Coach Thabo, verified volunteer, laptop + old Android phone:**
1. Opens his scheduled session "Grade 5: Go and stop (p2-motor-01)" 10 minutes early and enters the **coach studio**.
2. The laptop webcam shows his face. He plugs in a USB webcam on a desk arm pointing down at the cardboard robot: **Camera 2 – Desk**.
3. He taps **Add phone camera**, a QR code appears, and he scans it with his old phone on a stand, which joins as **Camera 3 – Phone** for a close-up of the wiring. No app install or login is needed on the phone.
4. He admits learners from the waiting room. The main view is the desk camera, with his face as a small extra.
5. He switches to **Code** and builds the "motor forward" program. Every learner sees the blocks update live in their own editor.
6. A learner raises a hand. Thabo reads the question in Q&A and switches the main view to the phone close-up to show the motor driver pins.
7. He ends the session. Attendance is saved, and learners keep a copy of the final program.

**Coach Zanele, verified volunteer, tablet only:**
1. Opens the studio on her tablet in landscape, in a stand.
2. The front camera shows her face; the back camera points at the desk through a cheap holder.
3. The cameras, waiting room and questions panels slide in and out at the sides, so the main view stays large.

**Lerato, Grade 5, Android phone on prepaid data:**
1. Gets a notice in the platform (and her mother gets a WhatsApp reminder) and taps **Join**.
2. Sees the coach's main view at low resolution and the code in a tab. She turns on **Data saver**.
3. Taps the desk camera thumbnail to make it her main view while the coach wires the motor.
4. During the code part she switches to **Audio + code only**, which uses almost no data, and follows the blocks in the editor.
5. Taps **Copy to my programs** and runs it on the on-screen micro:bit afterwards, offline.

**Ms Naidoo, teacher, classroom projector + one laptop:**
Joins as a **class group** on the projector with two views side by side (coach + desk camera). The class asks questions through her account.

---

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | A coach (or admin) can **schedule a session**: title, linked lesson(s) or grade, date and time, duration, maximum learners, audience (enrolled learners of a class, a school, or the public with a parent-approved account) |
| FR-2 | **Join page** with the time, linked lesson, a device check (speaker, connection) and an estimate of data use for each view mode |
| FR-3 | **Waiting room**: learners wait until the coach admits them (one by one or all). Only signed-in, enrolled accounts can enter; join links expire when the session ends |
| FR-4 | **Learners cannot publish video**, enforced on the server by access token permissions, not just hidden in the interface. Learners' mics are off and can only be unmuted when the coach allows it |
| FR-5 | **Coach camera sources**: the device's own cameras (front and back, on laptops and tablets), any USB webcam (chosen from a list), and **phone cameras joined by QR**. Each source has a name, an on/off toggle, mirror and rotate. **At least 3 sources**, of which **at least 2 are visible at once** |
| FR-6 | **Phone as camera**: "Add phone camera" shows a QR code with a single-use link that expires after 5 minutes, tied to this session and this coach. The phone opens a web page (no install), asks for camera permission and publishes **video only** (no mic, to avoid echo). The coach can remove it at any time. A lost or disconnected phone is shown as "offline" and can rejoin with a new QR code |
| FR-7 | **Coach layout control**: choose the **main view** (any camera or Code), and **extra views** shown small or side by side. Learners see the coach's layout by default |
| FR-8 | **Learner view control** (option 1): learners can swap their main view to any live source, add or remove one extra view, or choose **Audio + code only**. Their choice affects only what they download |
| FR-9 | **Adaptive streaming** (option 2): every coach camera is sent in 3 quality levels (about 180p, 360p, 720p). The server sends each learner the level their connection and screen size can handle, pauses video nobody is watching, and drops to audio + code before audio breaks up |
| FR-10 | **Data saver** (default on for mobile networks): main view at most 360p, extra views as still frames refreshed every few seconds, video paused while the app is in the background |
| FR-11 | **Live code sharing**: the coach shares their editor, and program JSON changes are sent over the session's data channel (changes only, not the whole program each time). Learners see a read-only editor with the same blocks, a Python tab, and **Copy to my programs**. The coach can also share the on-screen micro:bit's state (LEDs, pins) |
| FR-12 | **Raise hand and Q&A**: learners raise a hand or type a question; questions are **visible to the coach and co-host only** until the coach shows one to the group. No private learner-to-learner messages |
| FR-13 | **Co-host role (optional)**: a coach may invite a second verified adult (coach, teacher or admin) to admit, mute, remove learners and moderate Q&A. Not required |
| FR-14 | **Moderation**: remove a learner, lock the session, mute everyone, end the session for all. Any participant can **report** a problem, which goes to the back office with the session log |
| FR-15 | **Attendance and session log**: who joined and left and when, Q&A text, moderation actions, reports. Kept by the retention rules in §8 |
| FR-16 | **Reminders**: in-platform notice; optional WhatsApp Business reminder to parents who opted in (time and link to the platform only) |
| FR-17 | All interface text goes through i18n. Captions are wired so they can be added later |
| FR-18 | **Streaming toggles** (§4a): learner view choice (option 1) and adaptive streaming (option 2) can each be switched **on or off**, with a platform default set by admin and a per-session override by the coach (within limits admin allows) |
| FR-19 | **Usage record per session**: the settings used, plus measured data per learner (average and highest) and total server traffic, saved with the session log and shown in a back-office cost report |
| FR-20 | **Studio on a tablet** (owner, 2026-11-27): the coach studio works on a tablet in landscape with the same controls; side panels (cameras, waiting room, questions) slide in and out so the main view stays large; touch targets at least 48 × 48 px |
| FR-21 | **View-only observers**: a parent of an enrolled learner, or a teacher of the class, may join any session as an observer (no mic, no Q&A), so sessions are always open to adults |
| FR-23 | **Names toggle for adults** (owner, 2026-11-27): in the coach studio, the session's attendance, raised hands and questions show **nicknames**; the class's own teachers and coaches (as in M5 FR-22a) can switch them to **first name + surname initial**, which is hard to do from memory with nicknames. Learners always see nicknames only. A volunteer host coach who is not one of the class's teachers or coaches sees nicknames only, until the owner decides otherwise (§14) |
| FR-22 | **Q&A flags**: questions that look like personal contact details or requests to move to another app are held back and flagged to the back office automatically; nobody reads logs routinely |

### 4a. Streaming toggles (owner decision 2026-11-22)

Both options stay in the product, but each one is a switch. This gives flexibility to lower cost and a clean way to test.

| Setting | On | Off |
|---|---|---|
| **Learner view choice** (option 1) | Learners can swap the main view, add one extra view, or choose Audio + code only | Everyone gets the coach's main view only (Audio + code only is **always** allowed, as the low-data safety net) |
| **Adaptive streaming** (option 2) | Each camera sent in 3 quality levels; server picks per learner; unwatched views paused | Each camera sent at **one fixed quality** chosen by admin or coach (180p, 360p or 720p); unwatched views still paused |

Extra limits admin can set alongside the toggles:
- **maximum views per learner** (1 or 2);
- **maximum coach cameras live at once**;
- **highest quality allowed**;
- **Data saver forced on** for all learners.

Where the switches live:
- **Platform default** (admin, back office): e.g. both on.
- **Per session** (coach studio, before or during a session): the coach can turn an option off to save data, but can't go above admin limits.
- **Learners** don't see the switches, only the result (e.g. no "add view" button when view choice is off).

Turning a switch during a live session takes effect within a few seconds without anyone rejoining.

**Testing with the toggles:** the spike and pilot run the same scripted 30-minute session in all four combinations. Each run records:
- data per learner;
- server traffic;
- coach upload;
- video quality complaints.

| Test | View choice | Adaptive | What it tells us |
|---|---|---|---|
| A | Off | Off | Baseline: simplest and most predictable cost |
| B | On | Off | Saving from learners choosing fewer or lighter views |
| C | Off | On | Saving from the server matching quality to each connection |
| D | On | On | Both together (expected best for learners) |

The results set the platform defaults and the numbers in §5.

---

## 5. Non-functional requirements

- **Learner data use** (to measure in the spike; working targets for a 30-minute session):

  | Learner mode | Rough data per 30 min |
  |---|---|
  | Audio + code only | ≤ 10 MB |
  | Data saver (one view, ≤ 360p) | ≤ 60 MB |
  | Standard (one view, adaptive) | ≤ 120 MB |
  | Two views | about the sum of both views |

  The join page shows these estimates so learners and parents can choose. Targets are for both toggles on; tests A–D (§4a) replace them with measured numbers for each combination.
- **Coach upload:**
  - 2 cameras with 3 quality levels each needs about 2–4 Mbps up.
  - The studio tests the connection and suggests turning off extra cameras or quality levels if it is too slow.
  - A phone camera on its own Wi-Fi uses its own upload.
- **Devices:**
  - Learners: a low-end Android phone (Chrome) at 360 px.
  - Coaches: Chrome or Edge on laptops, and Chrome on Android tablets; iPad Safari to be tested in the spike.
  - Phone as a camera: Android Chrome and iPhone Safari.
- **Latency**: under 1 second from the coach to learners, so Q&A feels live.
- **Scale per session**: up to **50 learner connections** at launch (a class group counts as one), with the cap configurable. Sessions of **30–45 minutes**.
- **Zero-rating**: all session traffic (web page, signalling, media, relay servers) on **our own domain and IP ranges**, so it can be put on zero-rated lists. No third-party meeting service domains.
- **Accessibility:**
  - WCAG 2.2 AA;
  - keyboard and touch control of every studio and learner control;
  - screen-reader labels on views;
  - code is always available as text (blocks + Python), not only as video.
- **Security headers**: the strict CSP stays; the media and relay domains are added to `connect-src` only.

---

## 6. Technical architecture

```
 Coach laptop / tablet                 Old phone (QR)        USB / desk webcam
  ├─ device cameras ┐                       │                       │
  ├─ desk webcam ───┼──► WebRTC, 3 quality levels per camera ◄──────┘
  ├─ mic            │                       │
  └─ editor (program JSON changes) ──► data channel
                    ▼
        Media server (SFU) on our domain  ◄── session service (tokens, roles, waiting room, logs)
        - receives each camera once                 │
        - forwards to each learner only the         ├── accounts, classes, roles (M5)
          views they chose, at the quality          └── back office: coach verification, reports
          their connection can handle
                    ▼
 Learner phone: main view (+ optional extra) · read-only editor · Q&A · audio
```

- **Media server (proposed, ADR-0019): LiveKit, self-hosted** (Apache-2.0).
  - **Why it fits:** it is a selective forwarding unit (SFU): it forwards streams without re-encoding, so it is cheap to run.
  - **What it already supports for options 1 and 2:**
    - each camera as a separate track;
    - several quality levels per track;
    - each learner subscribing only to chosen tracks;
    - pausing tracks nobody watches;
    - quality chosen per learner by bandwidth and screen size;
    - data channels;
    - permissions per token, so learner tokens can't publish video.
  - **Relay server:** a built-in TURN server for school networks that block normal video traffic.
  - **Alternatives to compare in the spike:**
    - Jitsi: heavier, built for meetings rather than our layout.
    - mediasoup: more control, more code to write.
    - A hosted service: fastest to start, but breaks the own-domain zero-rating rule and costs per minute.
- **Phone as camera**: the QR code holds a short-lived, single-use token that can **publish video only** into this session, under the coach's identity. The phone page is a tiny separate page (`/live/cam/`) that loads nothing else.
- **Code sharing** reuses `packages/blocks` from M3. The coach's program JSON changes go over the data channel, and learners' read-only editor rebuilds from them. The same validation as imported program files applies: size limit, Zod schema, unknown blocks rejected. No code is run on learners' devices unless they press Run on their own copy.
- **Session service**: a small Worker in the same pattern as the M5 services. It:
  - issues tokens with the right permissions per role (coach, co-host, observer, learner, class group, phone camera);
  - runs the waiting room;
  - records attendance and logs;
  - handles reports.
- **Pages**: `/live/` (my sessions), `/live/<id>/` (learner view), `/live/<id>/studio/` (coach), `/live/cam/` (phone camera). Video code loads only on these pages.

---

## 7. Screens (sketched on the build-plan board, approved 2026-11-27)

**Learner's phone (portrait)**
- **Main view** fills the top of the screen: the coach's camera by default.
- A **small extra view** in a corner (e.g. the desk camera); tap to swap it with the main view.
- When the coach shows code: **real blocks** in a read-only editor, not video, with **Copy to my programs**.
- **Bottom bar:** ✋ raise hand · 💬 ask a question · view choice (Full / Data saver / Audio + code).
- No learner camera; mic off unless the coach unmutes it.

**Coach's studio (laptop or tablet)**
- **Top bar:** session timer and a data-use meter showing what learners are downloading.
- **Left: cameras.** Front camera (face), back camera or USB desk camera, old phone by QR. Each has an on/off switch, plus **Add phone camera (QR)**.
- **Centre: stage.** The main view (any camera or **Code**) and up to two extra views.
- **Right panel:** waiting room (Admit / Admit all), raised hands, questions to approve, attendance.
- **Bottom bar:** mic on/off, Show code, Unmute a learner, End session.
- **On a tablet:** the same screen in landscape. The side panels slide in and out, and a stand or holder points the back camera at the desk.

**Teacher's projector (class group)**
- Coach camera and desk camera side by side, large enough for the back of the class.
- The class asks questions through the teacher's account.

---

## 8. Security, privacy and child safety

- **Coach verification (back office, before a coach can host):**
  - identity check;
  - a police clearance certificate;
  - a check that the person is not on the National Register for Sex Offenders or Part B of the Child Protection Register;
  - agreement to a coach code of conduct;
  - a short safeguarding training module.

  *The owner still needs to confirm the exact legal checks with a lawyer, since the Children's Act and the NRSO rules may apply to volunteers working with children.*
- **No mandatory co-host and no routine log review** (owner, 2026-11-22): both are not practical at volunteer scale. Logs are kept and reviewed on request instead. Safeguarding rests on the built-in controls:
  - verified coaches;
  - no learner video;
  - no private messages;
  - waiting room;
  - view-only observers (FR-21);
  - automatic Q&A flags (FR-22);
  - the report button;
  - kept logs.
- **Learners:**
  - no learner video, and mics off by default;
  - no learner-to-learner private messages;
  - other learners see **nicknames only**: no real names, schools or photos (M5);
  - the class's own teachers and coaches can switch to first name + surname initial (FR-23).
- **Access:**
  - signed-in, enrolled accounts only (M5), with parent or guardian consent for learners under 18 (POPIA);
  - waiting room on by default;
  - single-use, expiring links;
  - phone-camera tokens can publish video only, and they expire.
- **Recording: off for now** (owner, 2026-11-22). Not built; if added later, it needs notice, consent and a retention period.
- **Data kept** (owner, 2026-11-22: store for review on request):
  - **What:** attendance, Q&A text, moderation actions, reports and streaming settings. No media is stored.
  - **How:** stored encrypted and **opened only on request**: a report or complaint, a request from a parent, school or the learner, or a legal request. Every opening is itself logged (who, when, why).
  - **How long:** 12 months, or longer only while a report or request is open (period to confirm with the information officer). Deleted automatically after that.
- **WhatsApp**: only opt-in reminders to parents through the WhatsApp Business Platform (time + platform link). Never grades, photos, recordings, learner names, or group chats with learners.
- **POPIA**: this feature processes children's personal data (attendance, questions). The legal basis is recorded, along with a privacy notice written for children and parents, and an operator agreement with any hosting provider.
- **Threat notes:**
  - tokens carry role permissions checked by the media server;
  - the server enforces "learners can't publish video";
  - uninvited join attempts are blocked by enrolment checks and the waiting room;
  - code-sharing messages are validated like imported files;
  - Q&A and hand raises are rate-limited.

---

## 9. Acceptance criteria

- [ ] A coach can publish 3 camera sources (device camera, USB webcam, phone by QR) and show 2 at once, on a laptop and on a tablet layout (e2e with fake media devices).
- [ ] A phone joins as a camera by QR without installing anything; the link works once and expires after 5 minutes (e2e).
- [ ] A learner token cannot publish video or audio unless unmuted, even if the client is modified (server test).
- [ ] A learner who watches only the main view downloads only that track; unwatched views are paused (measured in the spike, CI check on subscriptions).
- [ ] On a throttled 3G-like profile, a learner gets a lower quality level and then audio + code, without audio breaking up (e2e with network throttling).
- [ ] Live code sharing: learners' read-only editor matches the coach's program within 1 second; Copy to my programs gives the same program JSON (e2e).
- [ ] Waiting room, remove, lock, mute all, end for all, observers and report all work and are logged (e2e).
- [ ] A question with a phone number or "message me on WhatsApp" is held back and flagged (unit + e2e).
- [ ] All session traffic stays on our domains (e2e network check), and there are no CSP violations.
- [ ] Data use per mode measured and written into §5 and the test plan.
- [ ] Each toggle (view choice, adaptive streaming) can be switched on and off by admin and per session; switching during a live session takes effect within 5 seconds without rejoining; Audio + code only stays available with both off (e2e).
- [ ] Tests A–D (§4a) run and recorded; the per-session usage record (FR-19) matches the measurements within 10%.
- [ ] Deferred to `docs/test-plan.md`:
  - real sessions on low-end Android with prepaid data;
  - school networks behind firewalls (relay server);
  - a coach on an Android tablet and on an iPad;
  - iPhone Safari as a phone camera;
  - a 50-learner load test;
  - TalkBack and keyboard checks;
  - a pilot with two volunteer coaches.

---

## 10. Work plan for Claude Code

One PR per step. CI must pass before merging. ⏸ marks a stop for review.

1. **Spike + ADR-0019** ⏸:
   - self-host LiveKit (or the best alternative) on a test server;
   - one coach publishing 2 cameras with 3 quality levels, from a laptop and a tablet;
   - one learner choosing views;
   - measure data use per mode and coach upload;
   - relay server on our domain;
   - build both toggles early and run tests A–D (§4a).
2. **Session service**: schedule, roles, tokens with permissions, waiting room, attendance, logs, observers.
3. **Learner view**: main and extra views, swap, Data saver, Audio + code only, hand raise, Q&A, flags.
4. **Coach studio**: sources bar, USB camera picker, layout control, moderation, co-host; laptop and tablet layouts.
5. **Phone as camera**: QR flow, `/live/cam/` page, expiry, reconnect.
6. **Live code sharing**: program JSON changes over the data channel, read-only editor, Copy to my programs, micro:bit state sharing.
7. **Safeguarding and back office**: coach verification workflow, reports queue, retention jobs, WhatsApp reminder opt-in.
8. **Pilot** ⏸: two coaches, two schools or clubs; test-plan rows completed.

---

## 11. AI opportunities

- **Session summary (M6 helper)**: after the session, AI drafts a short summary and "what to try next". It uses the linked lesson, the final program and the Q&A text (no media, no learner names), and the coach reviews it before learners see it.
- **Coach assistant**: suggests answers to common Q&A questions from the lesson content.
- **Later**: live captions and translation into home languages.

## 12. Cost and revenue notes

- **Main cost is server traffic (egress)**: about learners × views × bitrate × minutes. Options 1 and 2 keep it down because most learners receive one low-quality view. The spike measures real numbers for a cost-per-session estimate.
- **Toggles are the cost lever** (§4a): if traffic costs rise or a sponsor's data budget is tight, admin can turn options off or cap quality platform-wide in seconds, without a code change. The per-session usage record shows what each setting really costs.
- **Hosting**: one self-hosted media server on a VPS can handle the launch scale. A hosted service would cost per participant-minute and would break the zero-rating rule.
- **Core sessions stay free.** Possible add-ons:
  - private sessions for schools;
  - coach certification;
  - sponsored sessions (e.g. by a mobile network as part of zero-rating).

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Video data cost locks out poor learners | Exclusion | Audio + code only mode; Data saver default; zero-rating application; code sent as data, not video |
| Zero-rating partners may not include live video | Learners pay for data | Own domain and IP ranges from day one; ask the network early; audio + code works on very little data |
| Child safety incident with a volunteer coach | Harm, legal and reputational | Verification checks, observers and Q&A flags, logs kept for review on request, no learner video, no private messages, reports, code of conduct |
| Coach's upload too slow for 2+ cameras | Poor video | Connection test; suggest fewer cameras or quality levels; phone camera uses its own Wi-Fi |
| Tablet browsers limit two cameras at once | Coach can't show face and desk together | Test early in the spike; fall back to the tablet's back camera plus a phone by QR |
| School firewalls block WebRTC | Can't join | Relay server (TURN) over TLS on port 443 on our domain |
| iPhone Safari limits as a phone camera | Some coaches can't use their phone | Test early; USB webcam as the alternative |
| Server costs grow with usage | Sustainability | Measure per-session cost; cap session size; sponsorship |

## 14. Owner decisions

1. ~~Two adults rule~~ Decided 2026-11-22: no mandatory co-host, no routine review; logs stored and reviewed on request. Observers and Q&A flags approved with the spec (2026-11-27).
2. ~~Recording~~ Decided: off for now.
3. ~~Session size and length~~ Approved with the spec: 50 connections, 30–45 minutes.
4. ~~Coach device~~ Decided 2026-11-27: laptop or tablet.
5. ~~Names for adults~~ Decided 2026-11-27: learners see nicknames; the class's own teachers and coaches can toggle to first name + initial (FR-23).
6. **Still open:** confirm with a lawyer which legal checks apply to volunteer coaches (before step 7).
7. **Still open:** may a volunteer host coach who is not the class's own teacher or coach also see first name + initial? Default until decided: nicknames only.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.5 | 2026-11-27 | Owner: nicknames for learners; class's own teachers and coaches toggle to first name + initial (FR-23); question on outside host coaches |
| 0.4 | 2026-11-27 | Approved by the owner with the board sketches. Coach may use a tablet (FR-20). Observers (FR-21) and Q&A flags (FR-22) in. Nicknames instead of "first name + initial" (M5). Video-stack ADR renumbered to ADR-0019. Screens in §7 |
| 0.3 | 2026-11-22 | Owner: recording off for now; co-host optional, no routine log review; logs stored encrypted and opened only on request, with access logged; proposed observers and Q&A flags |
| 0.2 | 2026-11-22 | Owner: learner view choice and adaptive streaming can each be toggled on/off (admin default + per-session), for cost control and testing; §4a toggles and tests A–D; FR-18, FR-19 usage record |
| 0.1 | 2026-11-22 | First draft. Owner: coach shows block code + overhead/desk camera (toggle), switch to or add device camera, 2+ views; learners choose views + adaptive streaming (both); extra cameras by phone QR or USB webcam |
