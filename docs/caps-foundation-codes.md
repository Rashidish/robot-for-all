# CAPS Foundation Phase codes: Coding and Robotics (Grades R–3)

> **Version:** 0.1 · **Date:** 2026-11-28 · Source: DBE, *CAPS Coding and Robotics, Foundation Phase*, §2.12, Tables 2.2–2.4 (owner's copy in the project files). Short summaries in our own words for tagging lessons and Junior missions. Check the CAPS document itself for the full wording.
> Used by: Junior missions (`caps` field), Junior lessons (J-8a), Junior stories. The build accepts C.1–C.7, R.1–R.7 and D.1–D.10 (`CAPS_CODE` in `packages/sim/src/junior.ts`).

Levels per grade: Grade R **rudimentary**, Grade 1 **rudimentary/elementary**, Grade 2 **elementary**, Grade 3 **foundational**. **N/A** means CAPS doesn't teach that code in that grade, so don't tag it.

## Coding (C)

| Code | Competency (summary) | R | 1 | 2 | 3 |
|---|---|---|---|---|---|
| C.1 | Develop instructions to solve a problem (sequence picture stories, plan a route) | ✓ | ✓ | ✓ | ✓ |
| C.2 | Present a solution with symbols (arrows; repeats from Grade 1; turns and IF in Grade 2) | ✓ | ✓ | ✓ | ✓ |
| C.3 | Interpret and carry out given instructions (act out code) | ✓ | ✓ | ✓ | ✓ |
| C.4 | Debug: find and fix errors | ✓ | ✓ | ✓ | ✓ |
| C.5 | Evaluate: compare solutions, make them shorter or better | ✓ | ✓ | ✓ | ✓ |
| C.6 | Identify, recognise and copy patterns | ✓ | ✓ | ✓ | ✓ |
| C.7 | Create or complete a pattern (extend, create, explain) | N/A | ✓ | ✓ | ✓ |

## Robotics (R), Table 2.3

| Code | Competency (summary) | R | 1 | 2 | 3 | Junior notes |
|---|---|---|---|---|---|---|
| R.1 | Explain what a robot is in simple terms: its purpose; from Grade 2, how it works (moving and sensing parts) | ✓ | ✓ | ✓ | ✓ | Talk and draw: "What is a robot? What does it do?" |
| R.2 | Identify different kinds of robots and what they do (Grade 2: factory robots and service robots) | ✓ | ✓ | ✓ | ✓ | Picture sorting: robot or not? Which job? |
| R.3 | Outline that a robot is made of parts, each with a purpose (moving parts, sensors; Grade 2 adds power source and motors) | **N/A** | ✓ | ✓ | ✓ | Don't tag in Grade R |
| R.4 | Explain how robots affect the world: what they are used for (Grade 1: specific tasks; Grade 2: dangerous and repetitive jobs) | ✓ | ✓ | ✓ | ✓ | Story 5 "Robot tidies the classroom" |
| R.5 | Design a simple artefact to a specification: build a robot model (pipe cleaners, ice-cream sticks, straws; strings or pins to mimic movement; step-by-step or open build; assemble-by-numbers games); then talk about what it can do | ✓ | ✓ | ✓ | ✓ | Cardboard robot build lessons |
| R.6 | Mimic a robot's operations from given instructions: in person, with a tool or on paper (links C.1–C.5) | ✓ | ✓ | ✓ | ✓ | Pairs mode: one child is the robot |
| R.7 | Create, test and run a set of robot instructions to do a task (links C.1–C.5; can be done as R.6) | ✓ | ✓ | ✓ | ✓ | Junior missions; real cart |

## Digital concepts (D), Table 2.4

| Code | Competency (summary) | R | 1 | 2 | 3 | Junior notes |
|---|---|---|---|---|---|---|
| D.1 | What technology is: point out examples, relate it to everyday life, technology as a tool | ✓ | ✓ | ✓ | ✓ | |
| D.2 | Living in a digital world: digital things are all around us; use devices safely (electricity, not while crossing the street) and in moderation (screen time). Grade 1: dangers of going online, cyberbullying. Grade 2: passwords keep information private; a digital footprint | ✓ | ✓ | ✓ | ✓ | Story 6 "Say no, tell a grown-up" (Grades 1–2) |
| D.3 | What a computing device is: point out examples. From Grade 1: it follows and interprets instructions | ✓ | ✓ | ✓ | ✓ | |
| D.4 | Common uses of ICT in the real world: name IT devices and what they're used for | **N/A** | ✓ | ✓ | ✓ | Don't tag in Grade R |
| D.5 | Hardware (touchable) versus software ("apps") | **N/A** | **N/A** | ✓ | ✓ | Grade 2 and up only |
| D.6 | How technology changed the way we live and work | **N/A** | **N/A** | ✓ | ✓ | Grade 2 and up only |
| D.7 | Input → processing → output: an input causes an output; different inputs give different actions | ✓ | ✓ | ✓ | ✓ | micro:bit button → beep or light |
| D.8 | Interpret (decode) a pattern into a message or image (Grade 1–2: a picture or a few words) | ✓ | ✓ | ✓ | ✓ | With C.6 |
| D.9 | Create (encode) a pattern to show a message or image | ✓ | ✓ | ✓ | ✓ | With C.6 and D.8 |
| D.10 | Basic proficiency in digital skills | **N/A** | **N/A** | **N/A** | **N/A** | Not in the Foundation Phase: never tag Grades R–3 |

## For the build

- Tag only codes that apply in the lesson's or mission's grades (the N/A cells above). A build check for this is welcome: e.g. R.3 or D.4 on a Grade R item fails.
- Junior lessons (J-8a) mostly cover **R.1, R.2, R.4, R.5, D.1, D.2, D.3, D.7**. The grid missions cover **C.1–C.5, R.6, R.7**; patterns cover **C.6, C.7, D.8, D.9**.
