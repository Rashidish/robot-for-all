---
id: p2-motor-03
title: 'Two motors: turning'
phase: 2
grades: [6, 7]
mechanism: motor-control
syllabus_links:
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.6 Mimic the operations of a robot - two actuators working together to steer (to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: Algorithms and coding - sequence and repetition (to confirm)
  - subject: Mathematics (CAPS, Intermediate Phase)
    topic: Space and shape - turns and angles (quarter turn, half turn) (to confirm)
duration_minutes: 90
cost_estimate_zar: 110
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: BBC micro:bit with its 2 × AA battery pack, qty: 1, substitute: the on-screen micro:bit and Robot view (no motors needed) }
  - { item: micro:bit edge-connector breakout board, qty: 1, substitute: a motor driver board that the micro:bit plugs into (follow its own wiring diagram) }
  - { item: L9110S two-motor driver module from Go and stop, qty: 1 }
  - { item: small DC motor (type 130) with a wheel, qty: 2 }
  - { item: AA batteries in a 2 × AA holder for the motors, qty: 2, substitute: rechargeable AA batteries }
  - { item: jumper wires (female ends for the driver pins), qty: 6 }
  - { item: the rolling cardboard cart from Phase 1, qty: 1 }
  - { item: tape and Prestik, qty: 1 }
outcomes:
  - Explain how a robot with two motors steers by running them at different speeds
  - Make a robot drive straight, spin on the spot and curve
  - Use repeat to turn a sequence of moves into a shape
concepts: [left motor, right motor, speed, turn, spin, curve, repeat]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - An adult checks all the wiring before the motor batteries go in
    - Take a battery out at once if anything gets hot, smells or smokes, and tell an adult
    - Run the robot on the floor, away from stairs, table edges and water
starter_program: turning
world: open-floor
hardware: microbit-motor
assessment:
  - I can explain how two motors make a robot turn left or right
  - I can make my robot spin on the spot and drive in a curve
  - I can use repeat to make my robot drive a square
  - I can change the speeds and say what changed
prerequisites: [p2-robot-01]
next: p2-whisker-01
templates: []
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A car turns with its steering wheel. Many small robots have **no steering wheel**: they have two wheels, each with its own motor. They turn by making one wheel go faster than the other.

![Wiring for two motors: the micro:bit sits in a breakout board (1). Leads (2) join P0 and P1 to A-IA and A-IB, P2 and P8 to B-IA and B-IB, and GND to GND on the motor driver (3). The left motor (4) is on the driver's motor A terminals and the right motor (5) on motor B. The 2 × AA motor batteries (6) are joined to VCC (+) and GND (−).](./images/two-motor-wiring.svg)

1. **micro:bit in a breakout board**
2. **Leads**: P0, P1, P2, P8 and GND
3. **Motor driver**
4. **Left motor**
5. **Right motor**
6. **Motor batteries**

Open the starter program. Button A uses both motors. Button B uses them differently. Talk with a partner:

- What will the robot do when you press A?
- What will it do when you press B? Which way will it turn?
- What do you think happens if the left motor goes faster than the right one?

## Run

1. Tap **Run**, then open the **Robot** view. Press **A**, then **B**. Watch the robot and the **Left motor** and **Right motor** lines.
2. **With real parts:** fix the two motors on the cart, one on each side, with their wheels pointing forward. Build the circuit from the diagram with the motor batteries **out**. This is the wiring for the basic L9110S board; another board has its own wiring diagram.
3. Ask an adult to check every wire. Then send the program and put the motor batteries in.
4. Press A and B. Was your prediction right? If a wheel turns the wrong way, swap that motor's two wires (batteries out first).

## Investigate

1. When you press B, one motor goes forward and the other goes backward. Where does the robot turn: around one wheel, or around its middle?
2. Change button B so the left motor goes forward at 60 and the right motor **stops**. How is this turn different?
3. Change button A so the left motor goes at 60 and the right at 30. What shape does the robot drive? Turn on **Show the trail** to see it.
4. How long must button B spin for the robot to make a **quarter turn**? Try 400, 650 and 900 milliseconds.

## Modify

1. Make button B spin the other way.
2. Use a **repeat 4 times** block: drive forward 1 second, then make a quarter turn. Does your robot come back to where it started? Turn on **Show the grid** to check.
3. Make button A drive in a big circle.

## Make

Make a **robot dance**: at least four different moves (straight, spin, curve, backward) in a sequence that repeats. Write the moves as numbered steps first, then code them. Show your dance on the screen and, if you have parts, on the floor. What did you have to change so the floor robot matched the screen robot?

## Teacher notes

- **Timing**: 15 min predict, 25 min build and run, 25 min investigate and modify, 25 min make.
- **Big idea**: **differential drive**. Same speed: straight. Opposite directions: spin on the spot (around the middle). One wheel stopped: turn around that wheel. Different speeds: a curve. This is how most floor robots and many wheelchairs steer.
- **Blocks**: the **Robot** extension (left and right motor at a speed). The Motors blocks from earlier lessons drive only the left motor; with two motors, use the Robot blocks for both.
- **Quarter turn**: on screen about 650 ms at speed 60 spins a quarter turn. Real robots differ (battery, floor, wheels): this is why the next lessons use **sensors** instead of timing.
- **No hardware?** The whole lesson works on screen: the Robot view shows the turns, and the trail and grid make shapes easy to check.
- **Wiring**: P8 is a small pin on the micro:bit's edge, so the basic board needs a **breakout board** to reach it (or a driver board the micro:bit plugs into). Pins belong to the wiring, not the program: the program says "left motor 60" and the board's wiring decides the pins (ADR-0008).
- **Electrical design check (CLAUDE.md §8)**: battery-only, low voltage. Both motors run from one 2 × AA (3 V) holder through the L9110S (about 2.5-12 V, 800 mA per channel); two type-130 motors at 3 V stay well inside that. The micro:bit sends 3 V logic signals only; GND is shared. No coin cells, no mains.
- **Common problems**: robot goes in circles when it should go straight (one motor is wired backwards: swap its two wires; or one wheel rubs on the cart); nothing on motor B (P2/P8 leads on the wrong driver pins, or the breakout board not pushed in fully).
