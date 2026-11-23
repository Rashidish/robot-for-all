---
id: p2-robot-01
title: Robot that reacts
phase: 2
grades: [6, 7]
mechanism: sensor-control
syllabus_links:
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.5 Use a variable and the light sensor to control an actuator (Grade 6 Term 4 - one variable only; to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.6 Mimic the operations of a robot - sense, decide, act; the shake (movement) sensor (to confirm)
  - subject: Coding and Robotics (CAPS, Senior Phase)
    topic: Robotics - combining sensors, a controller and actuators in one system (Grade 7; to confirm)
duration_minutes: 90
cost_estimate_zar: 50
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: BBC micro:bit with its 2 × AA battery pack, qty: 1, substitute: the on-screen micro:bit (no motor needed) }
  - { item: the motor, motor driver and wiring from Go and stop, qty: 1 }
  - { item: AA batteries, qty: 4, substitute: rechargeable AA batteries }
  - { item: the rolling cardboard cart from Phase 1, qty: 1 }
  - { item: tape and Prestik, qty: 1 }
  - { item: shoebox or large book to make a dark tunnel, qty: 1 }
outcomes:
  - Explain how a robot senses, decides and acts in a loop
  - Use one variable to remember whether the robot should be driving
  - Combine the light sensor, the shake sensor, buttons and the motor in one program
  - Test a robot in a real place and improve it
concepts: [robot, sense-decide-act, variable, light sensor, shake, combining conditions]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - An adult checks all the wiring before the motor batteries go in
    - Take a battery out at once if anything gets hot, smells or smokes, and tell an adult
    - Run the robot on the floor, away from stairs, table edges and water
    - Tap the robot gently to test the shake sensor; never drop or throw it
starter_program: robot-reacts
hardware: microbit-motor
assessment:
  - I can explain sense, decide and act using my robot as the example
  - I can say what the variable driving remembers, and why the robot needs it
  - I can make my robot stop by itself in a dark tunnel
  - I can change one thing in my robot and test if it made it better
prerequisites: [p2-motor-02, p1-wheel-01]
next: null
templates: []
status: in_review
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A real **robot** does three things again and again: it **senses** (inputs), **decides** (the program), and **acts** (outputs). Your cart becomes a robot when it can react to the world by itself.

![Wiring: the micro:bit (1) joined by leads (2) to the motor driver (3); the motor (4) on the driver's motor A terminals; the 2 × AA motor batteries (5) on the driver's VCC and GND.](./images/motor-wiring.svg)

1. **micro:bit**: senses and decides
2. **Leads**
3. **Motor driver**
4. **Motor**: acts
5. **Motor batteries**

Open the starter program. It uses one **variable** called `driving`. A variable is a box with a name that remembers a value: here **1** means "I should be driving" and **0** means "stay still".

Talk with a partner:

- What happens when you press A? Does the motor start at once?
- What happens when the robot drives into a dark tunnel? When it comes out?
- What happens if somebody bumps (shakes) the robot?

## Run

1. Tap **Run** under the on-screen micro:bit. Press **A**. Open **Sensors** and move the **light** slider down and up. Then tap **Shake**.
2. **With real parts:** tape the micro:bit, its battery pack, the motor driver and the motor batteries onto the cart, and fit the motor to drive an axle. Ask an adult to check the wiring, then send the program.
3. Make a dark tunnel with a shoebox. Press A and let the robot drive towards it. Was your prediction right?

## Investigate

1. Fill in the table: what does each part of the program sense, decide or do?

   | Block | Sense, decide or act? |
   |---|---|
   | light level | |
   | if ... and ... | |
   | motor forward | |
   | on shake | |

2. Why does the robot start again when it comes out of the tunnel, but not after a shake?
3. Look at the Python tab. Find the line with `and`. What two things must both be true for the motor to go?
4. Take out the `set driving to 0` block from the shake event and test. What changes?

## Modify

1. Make the robot show a different face in the tunnel (for example, asleep) and a happy face when it drives.
2. Change the light threshold so the robot stops in the shade of a table. Measure the light level first.
3. Make the robot back away for longer after a shake, and then **carry on driving** instead of stopping.

## Make

Design a robot for a real problem, for example a **rhino patrol robot** that rests in the shade and wakes up in the sun, or a **parcel robot** that stops when it is put inside a dark box. Write what it must do as a list of **sense → decide → act** rules, code it, then test it in a real place. Change one thing at a time and record what made it better. Present your robot to the class: show the rules, the program and the robot working.

## Teacher notes

- **Timing**: 15 min predict and run on screen, 30 min build and wire (with the adult check), 15 min investigate, 30 min modify, make and present. It can be split over two lessons.
- **Big idea**: **sense → decide → act** in a loop. The forever loop checks the sensors many times a second; the variable remembers the learner's choice (the button press). CAPS introduces one variable at a time in Grade 6: `driving` is the only one.
- **Real micro:bit**: power it from its own 2 × AA pack so the robot is free to move; the motor keeps its separate 2 × AA pack through the driver. The light sensor is the LED display, so the display must face up and not be covered by tape.
- **Electrical design check**: two separate 2 × AA (3 V) packs, L9110S driver, micro:bit logic only, shared GND, no coin cells, no mains.
- **Common problems**: robot never starts (it's too dark: lower the threshold); robot stops and starts in daylight (the threshold is too close to the room's light level); shake doesn't work on the real robot (the motor shaking isn't enough: tap the cart firmly).
- **Extension**: a second motor and a second channel on the driver (B-IA, B-IB on pins P2 and P8) make a robot that can turn. Phase 3 projects build on this.
