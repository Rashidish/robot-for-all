---
id: p2-motor-01
title: Go and stop
phase: 2
grades: [6]
mechanism: motor-control
syllabus_links:
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.1-R.3 Components of a robot - controller and actuators (motors); digital output signals (on/off) (to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.5 Design a simple artefact based on a set of design instructions (Grade 6; to confirm)
  - subject: Natural Sciences and Technology
    topic: Energy and electricity - complete circuits, a separate power source for the motor (to confirm against CAPS)
duration_minutes: 60
cost_estimate_zar: 45
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: BBC micro:bit with USB cable or 2 × AA battery pack, qty: 1, substitute: the on-screen micro:bit (no motor needed) }
  - { item: L9110S motor driver board, qty: 1 }
  - { item: small 3 V DC hobby motor from the scribble robot, qty: 1 }
  - { item: battery holder for 2 AA batteries, for the motor, qty: 1 }
  - { item: AA batteries, qty: 2, substitute: rechargeable AA batteries }
  - { item: crocodile clip leads, qty: 3 }
  - { item: jumper wires (female ends for the driver pins), qty: 5 }
outcomes:
  - Explain why a motor needs a motor driver and its own batteries instead of the micro:bit's pins
  - Use the micro:bit's buttons to switch a motor on and off
  - Follow a wiring diagram and check it with an adult before switching on
concepts: [actuator, motor driver, pin, digital output, on/off, power supply]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - Never join a motor straight to the micro:bit's pins - it can break the micro:bit. Always go through the motor driver
    - An adult checks all the wiring before the motor batteries go in
    - Take a battery out at once if anything gets hot, smells or smokes, and tell an adult
    - Keep fingers and hair away from the spinning motor shaft
starter_program: go-and-stop
world: open-floor
hardware: microbit-motor
assessment:
  - I can point to the micro:bit, the motor driver, the motor and the motor batteries in the wiring diagram
  - I can explain why the motor has its own batteries
  - I can make the motor start with button A and stop with button B
  - I can explain how the motor block's signal reaches the motor through the wires, the motor driver and the batteries
prerequisites: [p2-light-01, p1-motor-01]
next: p2-motor-02
templates: []
status: in_review
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A motor is an **actuator**. It needs much more electricity than the micro:bit's pins can give. So we use a **motor driver**: a small board that works like an electric switch. The micro:bit sends tiny **on/off signals** from its pins, and the driver switches the motor's own batteries on and off.

![Wiring: the micro:bit (1) is joined with three leads (2) - P0 to A-IA, P1 to A-IB and GND to GND - on the motor driver (3). The motor (4) is joined to the driver's motor A terminals. The 2 × AA battery pack (5) is joined to VCC (+) and GND (−) on the driver.](./images/motor-wiring.svg)

1. **micro:bit**: the controller
2. **Leads**: P0, P1 and GND
3. **Motor driver** (L9110S)
4. **Motor**: the actuator
5. **Motor batteries**: 2 × AA, 3 V

Open the starter program. Find the **motor** blocks.

Talk with a partner:

- What will the motor do when the program starts? When you press A? When you press B?
- What will the display show each time?
- Why does the motor need its own batteries?

## Run

1. Tap **Run** under the on-screen micro:bit. Press **A**, then **B**. Watch the **Motor** line under the on-screen micro:bit, and the cart in the **Robot** view.
2. **With real parts:** build the circuit from the diagram with the motor batteries **out**. Use crocodile clips on the big P0, P1 and GND rings of the micro:bit. (This is the wiring for the basic L9110S board. Another board has its own wiring diagram.)
3. Ask an adult to check every wire against the diagram. Then send the program to the micro:bit and put the motor batteries in.
4. Press A and B. Was your prediction right?

## Investigate

1. Under the on-screen micro:bit, what does the **Motor** line say when the motor goes forward? When it stops?
2. Look at the Python tab. Which line makes the motor go? What does the number 100 mean? What does `rfa_robot.stop()` do?
3. What happens if you press A twice? Why?
4. With real parts: take out one motor battery. What happens? What does that tell you about where the motor's power comes from?

## Modify

1. Make button A run the motor for 2 seconds only, then stop by itself. (Hint: **pause**, then **motor stop**.)
2. Show an arrow while the motor is going and a cross when it is stopped.
3. Make the motor start when it gets dark, using the light level from the night light lesson.

## Make

Make a **fan** or a **spinning sign** for a cardboard model. Fix a card propeller or a card sign on the motor shaft. Plan what should start and stop it (buttons, a timer, or light), then build it, test it and improve it. Draw your wiring and explain it to a partner.

## Teacher notes

- **Timing**: 10 min predict, 25 min wiring and run (with the adult check), 15 min investigate and modify, 10 min share. Pre-make the leads before class if possible.
- **No hardware?** The full lesson works on the on-screen micro:bit: the motor state shows under it, and the **Robot** view shows the cart moving on an open floor. One wired set per class or group is enough to show the real thing.
- **Pins belong to the wiring, not the program** (ADR-0008): the program says what the robot should do (`rfa_robot.motor("left", 100)`), and the board's wiring decides which pins carry it. P0 and P1 here are the basic L9110S board's wiring; on another board the same program works with that board's wiring diagram.
- **Electrical design check (CLAUDE.md §8)**: battery-only, low voltage. The motor runs from its own 2 × AA (3 V) holder through the L9110S driver (rated about 2.5-12 V, 800 mA per channel); the micro:bit only sends 3 V logic signals from P0 and P1, and GND is shared so the signals have a return path. The micro:bit is powered by USB or its own battery pack. No coin cells, no mains.
- **Common problems**: motor doesn't run (motor batteries in the wrong way, GND lead missing, or the leads on the wrong driver pins); motor runs the wrong way (swap the two motor wires; next lesson explains why); micro:bit resets when the motor starts (the motor is on the micro:bit's power: check the wiring).
- **Big idea**: a controller sends **signals**; a driver switches the **power**. Robots, washing machines and cars all work this way.
