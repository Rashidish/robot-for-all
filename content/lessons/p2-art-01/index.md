---
id: p2-art-01
title: Pen art
phase: 2
grades: [4, 5, 6]
mechanism: servo
syllabus_links:
  - subject: Mathematics (CAPS, Intermediate Phase)
    topic: Space and shape - 2D shapes, angles and turns; a square has four equal sides and four right angles (to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: Algorithms and coding - repeat loops; one set of steps repeated to make a pattern (to confirm)
  - subject: Natural Sciences and Technology (CAPS, Intermediate Phase)
    topic: Systems and control - a servo motor as an output that moves to a position (to confirm)
duration_minutes: 90
cost_estimate_zar: 65
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: the two-motor robot from Two motors - turning, qty: 1, substitute: the on-screen robot in the Robot view }
  - { item: SG90 micro servo with its arm, qty: 1, substitute: draw on screen only, or lift the pen by hand when the robot stops }
  - { item: 3 × AA battery holder with a switch, for the servo, qty: 1 }
  - { item: AA batteries, qty: 3 }
  - { item: jumper wires with female ends, qty: 3 }
  - { item: a koki (felt-tip pen), qty: 1 }
  - { item: thin cardboard for the pen lifter, qty: 1, substitute: cereal-box card }
  - { item: large sheet of paper for the floor, qty: 1, substitute: newspaper or the back of a poster }
  - { item: glue stick, tape and Prestik, qty: 1 }
outcomes:
  - Use a repeat loop to draw a shape with equal sides and equal turns
  - Explain how a servo moves to a position, and use it to lift and lower a pen
  - Work out the turn for a shape with a different number of sides
concepts: [servo, angle, right angle, repeat, loop, pattern, polygon]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders. Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - The servo has its own 3 × AA pack (4.5 V). Never join the servo pack's + to the micro:bit; join only the GND wires
    - An adult cuts the pen hole in the cart deck with a craft knife
    - Put the cap back on the koki when you finish so it doesn't dry out or mark clothes
starter_program: draw-a-square
world: art-floor
hardware: microbit-motor
assessment:
  - I can explain why the robot turns four times to draw a square
  - I can use a repeat block so I don't write the same blocks again
  - I can make my robot draw a shape with a different number of sides
  - I can lift and lower the pen with the pen blocks
prerequisites: [p2-motor-03]
next: p3-linemaze-01
templates: [pen-lifter]
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A **servo** is a small motor that turns to a position and stays there. Your robot will use one to lift a pen up and put it down, so it can draw as it drives.

![Pen lifter wiring: the micro:bit in its breakout board (1). The servo (2) has three wires: orange signal to P16, brown to GND, red to the + of its own 3 × AA battery pack (3). The pack's − also goes to GND. The servo arm lifts a card collar (4) on the pen, which stands in a sleeve in the middle of the robot.](./images/pen-servo-wiring.svg)

1. **micro:bit in a breakout board**: P16 and GND
2. **Servo**: orange to P16, brown to GND, red to the servo pack +
3. **Servo battery pack** (3 × AA): − to GND
4. **Pen collar** resting on the servo arm

Open the starter program. Talk with a partner:

- What will the robot draw when you press **A**?
- How many times do the blocks inside **repeat** run? Why that many?
- Why is the pen **up** when the program starts?

## Run

1. Tap **Run**, then press **A** on the on-screen micro:bit. In the **Robot** view the robot puts its pen down and draws. Open the **Monitor** and watch **Pen** change.
2. **With real parts:** print the template. Roll the pen sleeve round your koki and glue it. Ask an adult to cut the pen hole in the middle of the cart, halfway between the wheels. Glue the sleeve over the hole, and fold the servo stand and glue it beside the sleeve.
3. Wrap the collar round the pen and put the pen in the sleeve. Prestik the servo on the stand so its arm sits under the collar.
4. Join the wires as in the diagram. This is the wiring for the basic board; another board has its own wiring diagram. Ask an adult to check every wire before the batteries go in.
5. Put the robot on a big sheet of paper, send the program and press **A**.

## Investigate

1. What happens if you change the turn pause from 650 to 400? What shape do you get?
2. Change the drive pause from 1500 to 3000. What changes in the drawing, and what stays the same?
3. Take the **pen up** block out of the end. What happens when the robot is put back at the start?
4. Why must the pen be in the middle, halfway between the wheels? What would a corner look like if the pen were at the front?

## Modify

1. Draw a **triangle**: change the number of sides to 3. A square turns 90° four times (4 × 90° = 360°). How far does a triangle turn each time? Try a pause of about 870.
2. Draw a **dashed line**: pen down, drive, pen up, drive, again and again.
3. Make button **B** draw a bigger square.

## Make

Design your own **robot art**: a star, a house, a flower made of squares, or the first letter of your name. Plan it on paper first: how long is each side, and how much does the robot turn at each corner? Draw it on screen, then on the floor. Show your drawing and tell the class which blocks you repeated.

## Teacher notes

- **Timing**: 15 min predict, 30 min build and run, 20 min investigate, 25 min modify and make.
- **Big idea**: a shape is a pattern of "drive, turn" repeated. All the turns of a closed shape add up to 360°, so a shape with n equal sides turns 360 ÷ n at each corner. On screen at speed 60, the robot turns about 90° in 650 ms, so about 7.2 ms per degree: triangle 120° ≈ 870 ms, hexagon 60° ≈ 430 ms. A real robot turns at its own speed; learners find their own numbers by testing.
- **Pins belong to the wiring, not the program** (ADR-0008): the block says "pen down", and the board's wiring puts the servo on P16 (basic board). On P16 the servo turns to about 0° for pen down and 90° for pen up.
- **Servo power**: the SG90 is made for 4.8-6 V and draws up to about 250 mA when it moves, which is more than the micro:bit's 3 V pin can give. It has its own 3 × AA pack (4.5 V). Only the signal (P16) and GND join the micro:bit; the servo pack's + never does. Switch the servo pack off when you're not drawing.
- **On screen**: the whole lesson works in the Robot view, without a servo. Pen down draws the path on the art floor. Schools without a servo can lift the pen by hand when the robot stops.
- **Electrical design check (CLAUDE.md §8)**: battery-only, low voltage: motors on 2 × AA (3 V, L9110S) as in Two motors - turning; servo on 3 × AA (4.5 V), sharing only GND with the micro:bit; the micro:bit's P16 only sends a 3 V signal. No coin cells, no mains.
- **Common problems**: the pen doesn't touch the paper (let it slide freely in the sleeve; a heavier koki helps); the servo jitters or the micro:bit restarts (the servo pack is flat or the GND wires are not joined); the square doesn't close (the turn is too short or too long: change the turn pause); the lines wobble (paper wrinkles: tape the corners down).
- **Cost**: SG90 servo about R35, 3 × AA holder about R15, batteries about R5 each if you don't have them; the koki and card are already in the classroom.
