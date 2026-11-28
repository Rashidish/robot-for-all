---
id: p1-linkage-02
title: Waving robot (four-bar linkage)
phase: 1
grades: [5, 6]
mechanism: linkage
machines: [linkage, crank, pin-and-key]
syllabus_links:
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: Motion - rotational motion changed into a back-and-forth swing; R.6 Build a robot that mimics a human movement
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.5 Design a simple artefact based on design specifications; testing and reconfiguration
  - subject: Mathematics
    topic: Measurement - measuring angles with a protractor; comparing lengths (to confirm against CAPS)
duration_minutes: 60
cost_estimate_zar: 6
parts:
  - { item: thin cardboard (A4), qty: 2, substitute: cereal box }
  - { item: paper fastener (split pin), qty: 4, substitute: short pieces of straw with a knot of string through them }
  - { item: glue stick, qty: 1 }
  - { item: Prestik, qty: 1, substitute: small ball of clay }
  - { item: protractor, qty: 1, substitute: the paper protractor in the teacher notes }
outcomes:
  - Name the four links of a four-bar linkage and say which one does not move
  - Build a robot whose arm waves when a crank is turned
  - Measure how far the arm swings and explain how changing a link changes the swing
concepts: [four-bar linkage, fixed link, crank, coupler, rocker, angle]
safety:
  adult_help: false
  notes:
    - Make holes with a sharp pencil pushed into a ball of Prestik, never towards your hand
    - The legs of split pins are pointy - fold them flat
assessment:
  - I can point to the fixed link, the crank, the coupler and the rocker
  - I can explain how a full turn of the crank makes the arm swing back and forth
  - I can measure the angle the arm swings through
  - I can change one link and describe what happens to the wave
prerequisites: [p1-crank-01, p1-linkage-01]
next: p1-gear-01
templates: [waving-robot]
status: in_review
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A **four-bar linkage** has four links joined in a loop. One link is **fixed** (it doesn't move). One link turns all the way round: the **crank**. One link only swings back and forth: the **rocker**. The **coupler** joins the crank to the rocker.

![A robot body with a short crank (2) at its lower left and an arm (4) at its right shoulder. A long coupler (3) joins the crank to the arm. The fixed link (1) is the body between the two pivot holes.](./images/four-bar.svg)

1. **Fixed link**: the body, between the two pivot holes
2. **Crank**: turns all the way round
3. **Coupler**: joins the crank to the arm
4. **Rocker**: the arm that waves

Talk with a partner:

- The crank turns all the way round. Will the arm turn all the way round too? Why not?
- Where in your body is there a link that swings back and forth?

## Run

1. Print the **waving robot** template (check the square measures 50 mm), or draw the parts using the measurements.
2. Glue the template onto cardboard. Cut out the body, the crank, the coupler, the arm and the hand. Make every hole with a pencil and Prestik.
3. Join the **crank** to the body's **lower** pivot hole with a split pin. Join the **arm** to the body's **shoulder** hole through the arm's **first** hole.
4. Join one end of the **coupler** to the crank's outer hole, and the other end to the arm's **middle** hole.
5. Glue the **hand** onto the end of the arm.
6. Hold the body flat on the table and turn the crank all the way round, slowly.

## Investigate

1. Turn the crank one full turn. How many times does the arm wave up and back?
2. Hold a protractor at the shoulder. Measure the arm's lowest and highest angles. How many degrees does it swing through?
3. Watch the coupler. Does it turn all the way round, or does it wobble?
4. Is there a point where the crank gets stuck? Where are the links when this happens?

## Modify

1. Make a **longer crank** (cut a strip 55 mm long with holes 40 mm apart). Predict: will the arm swing more or less?
2. Test it. Does the crank still go all the way round?
3. Fill in the table:

   | Crank (hole to hole) | Arm swings (degrees) | Crank turns all the way? |
   |---|---|---|
   | 30 mm | | |
   | 40 mm | | |

4. What do you think will happen with a crank that is **too** long? Test it with a 60 mm crank if you have time.

## Make

Design a robot or animal that copies a real movement using a four-bar linkage: a bird flapping a wing, a person rowing a boat, or a robot saluting. Decide which link is fixed, which is the crank and which is the rocker. Draw and label your design, build it, and change the link lengths until the movement looks right.

## Teacher notes

- **Timing**: 10 min predict, 30 min build, 15 min investigate and modify, 5 min share.
- **Common problems**: crank jams (a split pin is too tight, or the coupler is joined to the wrong arm hole); arm swings too little (check the coupler joins the arm's middle hole, not the end); parts twist (keep all the links on the same side of the body).
- **Big idea**: in a crank-rocker four-bar linkage, the shortest link plus the longest link must be shorter than the other two added together, otherwise the crank can't go all the way round. Here: 30 + 90 is less than 80 + 60. A 60 mm crank breaks the rule: learners discover it jams.
- **Real world**: windscreen wipers, bicycle pedalling legs and many robot grippers are four-bar linkages. This links to the crank in the rhino lesson and prepares for motor-driven robots in Phase 2.
- **Paper protractor**: if there are no protractors, fold a paper circle in half, then in half again, then once more, to mark 45° steps.
