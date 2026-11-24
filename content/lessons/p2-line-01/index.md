---
id: p2-line-01
title: Follow the line
phase: 2
grades: [6, 7]
mechanism: sensor-control
syllabus_links:
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.6 Mimic the operations of a robot - sensors give inputs that decide the outputs (to confirm)
  - subject: Coding and Robotics (CAPS, Senior Phase)
    topic: Robotics - a feedback loop with two sensors and two actuators (Grade 7; to confirm)
  - subject: Natural Sciences and Technology (CAPS, Intermediate Phase)
    topic: Energy and change - light is reflected by light surfaces and absorbed by dark ones (to confirm)
duration_minutes: 90
cost_estimate_zar: 50
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: the two-motor robot from Two motors - turning, qty: 1, substitute: the on-screen robot in the Robot view }
  - { item: IR line sensor board (TCRT5000 type), qty: 2 }
  - { item: jumper wires with female ends, qty: 6 }
  - { item: black insulation tape (19 mm), qty: 1, substitute: a thick black koki line on white paper }
  - { item: a light floor or large sheets of white paper, qty: 1, substitute: the printed line course (Print course in the Robot view) }
  - { item: cardboard strip, tape and Prestik to hold the sensors, qty: 1 }
outcomes:
  - Explain how a line sensor tells a dark line from a light floor
  - Use two sensors to keep a robot on a line
  - Improve a feedback loop by testing and changing speeds
concepts: [line sensor, infrared, reflect, feedback loop, steer, if else]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - Power the sensor boards only from the micro:bit's 3V and GND, never from the motor batteries
    - An adult checks all the wiring before the motor batteries go in
    - Run the robot on the floor, away from stairs, table edges and water
starter_program: follow-the-line
world: follow-the-line
hardware: microbit-motor
assessment:
  - I can explain how a line sensor sees the difference between dark and light
  - I can say what my robot does when the line is under the left sensor, the right sensor, or neither
  - I can make my robot follow a curved line to the end
  - I can change a speed, test it and say if it got better
prerequisites: [p2-whisker-01]
next: p2-maze-01
templates: []
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A **line sensor** shines invisible infrared light at the floor and measures what bounces back. A light floor **reflects** a lot of light; a black line **absorbs** most of it. So the sensor can tell: "line under me" or "no line".

![Line sensor wiring: the micro:bit in its breakout board (1). Two IR line sensor boards (2) sit under the front of the robot, one each side of the black line (3). Each board gets 3V and GND from the micro:bit (4); the left board's signal goes to P13 and the right board's to P14 (5).](./images/line-wiring.svg)

1. **micro:bit in a breakout board**
2. **Line sensor boards**, left and right
3. **Black line**, between the sensors
4. **Power**: 3V and GND to both boards
5. **Signals**: left to P13, right to P14

Open the starter program. The robot starts with the line **between** its two sensors. Talk with a partner:

- If the line slides under the **left** sensor, which way has the robot drifted? Which way should it turn?
- What does the program do then? And for the right sensor?
- What does the robot do when neither sensor sees the line?

## Run

1. Tap **Run**. In the **Robot** view, watch the robot follow the curvy line to the finish. Open the **Monitor** and pick **Line under left sensor** for the graph.
2. **With real parts:** stick a line of black insulation tape on a light floor, with gentle curves. Or use **Print course** and lay the tape on the printed line.
3. Fix the two sensor boards under the front of the robot, about 40 mm apart and 5-10 mm above the floor, facing down. Wire them as in the diagram. This is the wiring for the basic board; another board has its own wiring diagram.
4. Ask an adult to check the wiring. Hold a sensor over the tape and over the floor: its small light should change. Send the program and test.

## Investigate

1. In the Monitor, how often does **Line under left sensor** change while the robot drives? What does each change mean?
2. Which blocks run when the line is under the right sensor? Why does that turn the robot right?
3. Change both "60"s to 100. Does the robot still follow the line? What goes wrong on the curves?
4. What would happen if the two sensors were swapped (left wired to the right side)?

## Modify

1. Make the robot follow faster on the straight parts but slower when it is turning.
2. When the robot reaches the end of the line and neither sensor sees it for a while, make it stop and show a happy face.
3. Change the turns so the robot steers more gently (the inside wheel slows down instead of stopping).

## Make

Make your own **line track** with tape: a start, at least three curves and a finish. Time your robot. Change one thing at a time (speed, sensor height, sensor distance) and keep the best time. Explain your best change to another group.

## Teacher notes

- **Timing**: 15 min predict, 30 min build and run, 20 min investigate, 25 min modify and make.
- **Big idea**: a **feedback loop**. The robot senses, decides and acts many times a second; each small correction keeps it on the line. This is the same idea as a thermostat or cruise control.
- **Two sensors, three cases**: line under the left sensor, the robot drifted right, so turn left; under the right sensor, turn right; neither, go straight. The line stays **between** the sensors.
- **Pins belong to the wiring, not the program** (ADR-0008): the block says "line under left sensor"; on the basic board the left sensor is P13 and the right P14 (small edge pins: use the breakout board). Most TCRT5000 boards say 1 over a dark line. If yours says the opposite (the robot steers away from the line), the robot's settings can flip the line sensors; until then, swap the two turn blocks.
- **Printed lines**: some inkjet black is invisible to infrared. Lay black insulation tape on the printed line (the printed course is a placement guide).
- **Electrical design check (CLAUDE.md §8)**: the sensor boards run from the micro:bit's 3 V (each uses about 10-20 mA); their signal pins go to micro:bit input pins. Motors as in Two motors - turning (2 × AA, 3 V, L9110S). No coin cells, no mains.
- **Common problems**: the robot spins on the spot (sensors too far apart or too high, or a sensor wired to the wrong pin); it loses the line on curves (go slower, or move the sensors further forward); sunlight confuses the sensors (shade them with a cardboard skirt).
