# Deferred test plan (people and devices)

> **Version:** 0.3 · **Date:** 2026-11-22 · **Owner:** Rashid Ishmail

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

---

## C. Before public launch (once)

| # | Check | Done |
|---|---|---|
| C1 | Custom domain connected; HTTPS works; security headers present on the live domain | |
| C2 | Vodacom ConnectU zero-rating applied for (then MTN, Telkom, Cell C) | |
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
