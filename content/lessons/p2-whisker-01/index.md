---
id: p2-whisker-01
title: Whisker bumper
phase: 2
grades: [5, 6]
mechanism: sensor-control
syllabus_links:
  - subject: Natural Sciences and Technology (CAPS, Intermediate Phase)
    topic: Energy and change - electric circuits; switches, open and closed circuits (Grade 6; to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.6 Mimic the operations of a robot - an input (touch switch) decides the output (to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: Algorithms and coding - if ... else decisions inside a loop (to confirm)
duration_minutes: 90
cost_estimate_zar: 5
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: the two-motor robot from Two motors - turning, qty: 1, substitute: the on-screen robot in the Robot view }
  - { item: metal paper clips, qty: 2 }
  - { item: kitchen foil, qty: 1, substitute: foil from a chips packet, shiny side out }
  - { item: jumper wires with crocodile clips or female ends, qty: 3 }
  - { item: thin cardboard for the bumper front, qty: 1, substitute: cereal-box card }
  - { item: glue stick and tape, qty: 1 }
outcomes:
  - Build a touch switch from a paper clip and foil, and explain open and closed circuits
  - Use a switch as a digital input (pressed or not pressed)
  - Program a robot that senses a wall, decides, and backs away
concepts: [switch, open circuit, closed circuit, input, digital, sensor, if else]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - An adult bends the paper clips with pliers; the ends are sharp, so point them forward and away from eyes
    - Join the whisker wires only to the micro:bit's 3V and its pins, never to the motor batteries
    - An adult checks all the wiring before the motor batteries go in
starter_program: whisker-bumper
world: simple-maze
hardware: microbit-motor
assessment:
  - I can explain how my whisker switch opens and closes a circuit
  - I can say what the micro:bit reads when a whisker is pressed and when it is not
  - I can make my robot back away and turn when a whisker touches a wall
  - I can test my bumper and make one improvement
prerequisites: [p2-motor-03]
next: null
templates: [whisker-bumper]
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

A **switch** is a gap in a circuit that can be closed. When the gap closes, electricity flows. Your robot will get two **whiskers**: bent paper clips that touch a strip of foil when they bump into something.

![Whisker wiring: the micro:bit in its breakout board (1). A lead (2) joins 3V to both paper-clip whiskers (3). A strip of foil (4) sits just behind each whisker; the left foil is joined to P12 and the right foil to P15. When a whisker bends back onto its foil, the circuit closes.](./images/whisker-wiring.svg)

1. **micro:bit in a breakout board**
2. **3V lead** to both whiskers
3. **Paper-clip whiskers**
4. **Foil strips**: left to P12, right to P15

Open the starter program. Talk with a partner:

- What does the robot do when no whisker is pressed?
- What does it do when a whisker touches a wall? In what order?
- Is the circuit **open** or **closed** when the whisker is not touching the foil?

## Run

1. Tap **Run**. In the **Robot** view the robot drives through the simple maze. Watch it back away and turn each time a whisker touches a wall. Open the **Monitor** to see the whiskers change from **no** to **yes**.
2. **With real parts:** print the template and cut out the bumper front. Push a paper clip through each hole and bend it forward like a feeler (an adult uses pliers). Glue a foil strip just behind each whisker.
3. Join the wires as in the diagram. This is the wiring for the basic board; another board has its own wiring diagram.
4. Ask an adult to check every wire. Send the program, put the batteries in, and let the robot drive at a box or a wall.

## Investigate

1. In the Monitor, what does **Left whisker pressed** say when the robot is in the open? When it touches a wall?
2. Which blocks run when a whisker is pressed? Which run when it isn't?
3. What happens if you make the backing-up pause 100 ms instead of 400? Why?
4. Why does the robot turn after backing up? What happens if you take the turn out?

## Modify

1. Make the robot turn **away** from the side that was touched: left whisker → turn right, right whisker → turn left. (Hint: use two **if** blocks, one for each whisker.)
2. Show an arrow on the display pointing to the side that was touched.
3. Change the speeds so the robot bumps more gently.

## Make

Make a **tidy-up robot** that wanders around a room (or the simple maze) without getting stuck. Test it for one minute. Count how many times it got stuck, change one thing, and test again. Write down what you changed and whether it helped.

## Teacher notes

- **Timing**: 15 min predict, 30 min build and run, 20 min investigate, 25 min modify and make.
- **Big idea**: a **switch** is an input with two states. Open circuit: the pin reads 0 (the micro:bit keeps it at 0 with a built-in pull-down resistor). Closed circuit: 3V reaches the pin and it reads 1. The whisker block says "pressed" when the pin reads 1.
- **Pins belong to the wiring, not the program** (ADR-0008): the block says "left whisker pressed", and the board's wiring decides the pin. On the basic board the left whisker is P12 and the right P15 (small edge pins: use the breakout board from Two motors - turning).
- **On screen**: the Robot view presses a whisker when the front of the robot touches a wall, so the same program works on screen and on the floor.
- **Electrical design check (CLAUDE.md §8)**: the whiskers carry only the micro:bit's own 3 V to its input pins, which is what the pins are made for; no motor current flows through the whiskers. Motors as in Two motors - turning (2 × AA, 3 V, L9110S). No coin cells, no mains.
- **Common problems**: the robot always backs up (a whisker is always touching its foil: bend it forward a little more); it never notices a wall (the whisker misses the foil, or the 3V lead isn't on the whisker); foil tears (use two layers, or a strip of foil tape).
- **Cost**: about R5 for clips and foil; everything else is reused from earlier lessons.
