# Deferred test plan (people and devices)

> **Version:** 0.22 · **Date:** 2026-11-24 · **Owner:** Rashid Ishmail

**Decision (2026-11-22, owner):** because of time and people constraints, building continues with **automated functional tests only** (CI must pass before anything merges). The human and device checks below are collected here and run **once the full application is complete**, before the first public launch of lessons.

**Safety stays on:** until these checks pass, the live site keeps hiding unreviewed lessons (`SHOW_DRAFTS=false` in production). Turning lessons on is a one-line change per lesson once the checks below are done.

How to use this list: add a row whenever a step adds something only a person can check. Tick it off with who did it and when.

---

## A. Every lesson (repeat per lesson)

| # | Check | Who | Done |
|---|---|---|---|
| A1 | **Content review**: a teacher or coach reads the lesson in a preview link; wording suits the grade; steps are clear | Teacher / coach | |
| A2 | **Build test**: someone builds the robot using **only the printed lesson and template**; it works | Volunteer / club | |
| A3 | **Safety check**: tools, adult-help flag and safety notes are right; no coin cells, no mains | Adult reviewer | |
| A4 | **CAPS links confirmed** by a teacher (Coding and Robotics outcomes, and any Maths/NST links still marked "to confirm") | Teacher | |
| A5 | Template printed and the **50 mm check square measures 50 mm ± 1 mm** | Anyone | |
| A6 | Record names in the lesson (`reviewed_by`, `build_tested_by`) and set `status: published` | Claude, on request | |

**Lessons waiting for A1–A6:**

| Lesson | A1 | A2 | A3 | A4 | A5 | A6 |
|---|---|---|---|---|---|---|
| p1-lever-01 Snapping crocodile | | | | | | |
| p1-wheel-01 Rolling cardboard cart | | | | | | |
| p1-crank-01 Crank-powered waving rhino | | | | | | |
| p1-linkage-01 Extending grabber | | | | | | |
| p1-cam-01 Bouncing animal box | | | | | | |
| p1-lever-02 Robot arm with three lever types | | | | | | |
| p1-linkage-02 Waving robot (four-bar linkage) | | | | | | |
| p1-gear-01 Spinning gear train | | | | | | |
| p1-pulley-01 Rubber-band pulley lift | | | | | | |
| p1-motor-01 One-motor scribble robot (**also: an adult checks the 3 V circuit and battery holders**) | | | | | | |
| p2-display-01 Blink a heart (A2 = run the starter on the on-screen and a real micro:bit; no template, so A5 n/a) | | | | | n/a | |
| p2-button-01 Button-controlled faces (as above) | | | | | n/a | |
| p2-light-01 Automatic night light (as above; also check the threshold works in a real classroom) | | | | | n/a | |
| p2-motor-01 Go and stop (**A3 includes the electrical design check: wiring diagram, L9110S, 2 × AA motor supply, shared GND**) | | | | | n/a | |
| p2-motor-02 Forward, stop, reverse (as above) | | | | | n/a | |
| p2-robot-01 Robot that reacts (as above; also: the micro:bit on its own 2 × AA pack, robot tested on the floor) | | | | | n/a | |
| p2-motor-03 Two motors: turning (as above; also: an adult checks the breakout board and two-motor wiring; the robot drives straight, spins and curves on the floor) | | | | | n/a | |
| p2-whisker-01 Whisker bumper (as above; also: an adult bends the paper clips; the bumper template printed at 100 %; the robot backs away from a real wall and the whiskers don't stay pressed) | | | | | | |
| p2-line-01 Follow the line (as above; also: an adult checks the sensor wiring; the robot follows a taped line with three curves on the floor; check the sensors see black insulation tape, and printed ink) | | | | | n/a | |
| p2-maze-01 Bump maze (as above; also: one printed stencil makes walls that stand by themselves when traced on cereal-box card; the tunnel roof halves join to 150 × 200 mm; the gate flap swings when the robot pushes it; the starter gets the real robot out of a six-wall maze) | | | | | n/a | |
| p2-art-01 Pen art (as above; also: an adult checks the servo wiring, with the servo pack + never joined to the micro:bit; the servo lifts the pen clear of the paper and lets it drop back; the real robot draws a square that closes to within 2 cm after tuning the turn pause; a cardboard SG90 stand holds the servo steady) | | | | | n/a | |
| p3-linemaze-01 Line maze (as above; also: the printed line maze tiles join and the taped lines match the screen; the real robot takes the left branch at a taped T junction and turns round at a dead end; two teams build, swap and race their own mazes) | | | | | n/a | |

---

## B. Devices and printing (once)

| # | Check | Done |
|---|---|---|
| B1 | Install and use on a **low-end Android phone** on mobile data | ✅ Owner, 2026-11-22 (Android + desktop) |
| B2 | Same phone in **airplane mode**: home, lessons, a downloaded lesson, its slides and template | |
| B3 | **TalkBack** (Android screen reader) on home, a lesson, slides and a template page | |
| B4 | **iPhone/Safari**: Share → Add to Home Screen, then offline use | |
| B5 | Print a template from **Chrome on Android** and from **Chrome/Edge on Windows**; 50 mm square correct | |
| B6 | Slides on a **projector** or large TV in a classroom; readable from the back | |
| B7 | Samsung Internet browser: install and offline | |
| B8 | **micro:bit**: on `/code/`, Send to micro:bit from Chrome/Edge on a computer; the heart blinks. Then Download .hex and copy it to the MICROBIT drive. Note the board version (V1/V2, printed on the back) | ✅ Owner, 2026-11-22 (Windows, Chrome): Send and Download both work |
| B10 | **Your own program**: blocks with button A, sent to the micro:bit | ✅ Owner, 2026-11-22 |
| B11 | **On-screen micro:bit vs real**: the same program behaves the same on both (LEDs, buttons, motor pins with the motor driver) | |
| B12 | **Sound on the on-screen micro:bit**: a program with music plays sound on a phone **and** a laptop (Windows Chrome) after tapping Run. If not: tap **Test sound** (a beep means the computer's sound works) and note the browser and whether "Sound is off" shows | |
| B14 | **Answer sheet**: print two lessons' answer sheets on a school printer; one A4 page each; learners in Grades 3–7 can read the questions and have enough room to write | |
| B15 | **Motor driver extension** on real parts: two motors on an L9110S (A on P0/P1, B on P2/P8, 2 × AA motor supply, adult wiring check); speeds 30%, 60%, 100% forward and backward match the on-screen micro:bit | |
| B16 | **Robot profile `l9110s-basic` on a real board** (micro:bit + L9110S): with `rfa_robot`, left and right motors go forward and backward at 30 %, 60 % and 100 %; stop stops both; whiskers on P12/P15 and line sensors on P13/P14 read right (check the line polarity on black insulation tape); the pen servo on P16 goes down and up. Then set `testedBy` and `status: published` in the profile | |
| B17 | **Robot sensors panel** on a phone with TalkBack: the four whisker and line checkboxes are announced and can be ticked; the left/right motor and pen lines are read out when they change | |
| B18 | **Robot tab on a budget Android phone**: the robot moves smoothly (about 30 frames a second) in the follow-the-line world with the micro:bit running; "Where is the robot?" and the challenge result are read out by TalkBack; the Monitor table is read row by row and the grid letters are readable | |
| B19 | **Surprise maze on two devices**: type the same maze number and size on two different phones; the mazes look the same. The mission checklist is read out by TalkBack, with "done" or "not done yet" for each mission | |
| B20 | **Print course on two different printers**: print bump maze 4817 (4 × 4) at 100 % from a phone or laptop; the calibration square measures **100 mm ± 1 mm** on both; the 15 tiles join with the corner marks lined up, following the assembly map; the build sheet's 25 walls match the walls on screen; lines and zones are readable on a black-and-white printer | |
| B21 | **Season 1 "Rhino Patrol" on the floor**: print and build the three courses (Junior 4 × 3, Grade 5–6 5 × 4, Senior 6 × 5) from Print course; each fits a classroom floor or a corridor; the tunnel, gate flap and waterhole walls stand up; a Grade 3–4 group finishes Junior with timed moves, and a Grade 7–9 group finishes Senior with sensors; teachers say the mission names and difficulty suit each grade band | |
| B13 | **Open in code editor** from a Phase 2 lesson on a phone, then Run and Send to micro:bit | |
| B9 | **micro:bit from Android**: Send to micro:bit over a USB-OTG cable in Chrome | |

---

## C. Before public launch (once)

| # | Check | Done |
|---|---|---|
| C1 | `robotsforall.org.za` connected (`docs/deploy.md` §4); HTTPS works; security headers present; `SITE_URL` variable set; `www.`, `robotsforall.co.za` and `robotsforall.africa` redirect to it with the path kept; the app installs and works offline from the new address | |
| C2 | Vodacom ConnectU zero-rating applied for `robotsforall.org.za` (then MTN, Telkom, Cell C) | |
| C3 | Privacy page reviewed by the owner against POPIA | |
| C4 | Licence of `@inlang/plugin-message-format` confirmed (build-time tool) | |
| C5 | A short pilot: one class or club uses 2–3 lessons and gives feedback | |

---

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-22 | First list: lessons 1–3, devices, launch checks |
| 0.2 | 2026-11-22 | Lessons 4–6 added |
| 0.3 | 2026-11-22 | Lessons 7–10 added |
| 0.4 | 2026-11-22 | micro:bit flashing checks (B8, B9) |
| 0.5 | 2026-11-22 | B8 passed |
| 0.6 | 2026-11-22 | B10 passed; B11 added |
| 0.7 | 2026-11-22 | Six Phase 2 lessons added; B12 (laptop sound) and B13 (Open in code editor) |
| 0.8 | 2026-11-23 | B12 adds the Test sound check; B14 answer sheets |
| 0.9 | 2026-11-23 | B15 motor driver extension |
| 0.10 | 2026-11-23 | B16 robot profile `l9110s-basic` on a real board (ADR-0008) |
| 0.11 | 2026-11-23 | B17 Robot sensors panel with TalkBack |
| 0.12 | 2026-11-23 | C1, C2 name the hostname `robotsforall.org.za` and the redirects |
| 0.13 | 2026-11-23 | B18 Robot tab on a budget phone and with TalkBack |
| 0.14 | 2026-11-23 | B19 maze numbers on two devices; mission checklist with TalkBack |
| 0.15 | 2026-11-23 | B20 print course on two printers |
| 0.16 | 2026-11-24 | Lesson p2-motor-03 Two motors: turning |
| 0.17 | 2026-11-24 | Lesson p2-whisker-01 Whisker bumper |
| 0.18 | 2026-11-24 | Lesson p2-line-01 Follow the line |
| 0.19 | 2026-11-24 | Lesson p2-maze-01 Bump maze |
| 0.20 | 2026-11-24 | Lesson p2-art-01 Pen art |
| 0.21 | 2026-11-24 | Lesson p3-linemaze-01 Line maze |
| 0.22 | 2026-11-24 | B21 Season 1 courses on the floor |
