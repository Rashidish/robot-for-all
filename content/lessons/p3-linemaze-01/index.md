---
id: p3-linemaze-01
title: Line maze
phase: 3
grades: [6, 7]
mechanism: sensor-control
syllabus_links:
  - subject: Coding and Robotics (CAPS, Senior Phase)
    topic: Algorithms and coding - nested if ... else decisions inside a loop (Grade 7; to confirm)
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: R.6 Mimic the operations of a robot - sensors decide the outputs (to confirm)
  - subject: Mathematics (CAPS, Intermediate Phase)
    topic: Space and shape - position and movement; left and right turns on a grid (to confirm)
duration_minutes: 90
cost_estimate_zar: 10
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: the line-following robot from Follow the line, qty: 1, substitute: the on-screen robot in the Robot view }
  - { item: black insulation tape (19 mm), qty: 1, substitute: a thick black koki line on white paper }
  - { item: a light floor or large sheets of white paper, qty: 1, substitute: the printed line maze (Print course in the Robot view) }
  - { item: a box or a sheet of coloured paper for the finish, qty: 1 }
outcomes:
  - Use the left-hand rule to solve a maze
  - Combine two line sensors and two motors in a program with three choices
  - Plan, build and test a line maze for another team
concepts: [maze, algorithm, left-hand rule, junction, dead end, nested if, debug]
safety:
  adult_help: false
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - Run the robot on the floor, away from stairs, table edges and water
    - Peel tape off the floor at the end; don't leave lines for people to slip on
starter_program: left-hand-line
world: line-maze
hardware: microbit-motor
assessment:
  - I can explain the left-hand rule and why it gets out of a maze
  - I can say which blocks run when the line is under the left sensor, the right sensor, or neither
  - I can make my robot reach the finish of a line maze
  - I can build a line maze and test it with another team's robot
prerequisites: [p2-line-01, p2-maze-01]
next: null
templates: []
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

In **Bump maze** your robot felt its way along a wall. Now the maze is made of **lines** with **junctions** (places where lines meet) and **dead ends**. The **left-hand rule** says: at every junction take the leftmost way, and at a dead end turn round. A robot that keeps doing this gets to the finish.

![A small line maze seen from above. The robot always takes the leftmost way: at the first junction (1) it turns left, at the dead end (2) it turns round and comes back, at the next junction (3) it turns left again and reaches the finish (4). It never needs the line that goes straight on.](./images/left-hand-rule.svg)

1. **Junction**: take the leftmost way
2. **Dead end**: turn round
3. **Keep left** at every junction
4. **Finish**

Open the starter program. Talk with a partner:

- What does the robot do when the line is under the **left** sensor? Under the **right** sensor? Under **neither**?
- Why does the robot spin right when it can't see the line?
- Which way will it go at the first junction?

## Run

1. Tap **Run**. In the **Robot** view the robot follows the line's left edge through the line maze. Watch the arrows on the display: they show which choice the program made.
2. Try two other **maze numbers**. Does the same program reach the finish every time?
3. **With real parts:** in the Robot view, choose the line maze and tap **Print course**. Lay the tiles on the floor and tape over the lines with black insulation tape. Or tape your own maze from the plan your teacher draws on the board.
4. Send the program to your robot, put it at the start and let it go.

## Investigate

1. Open the **Monitor**. Which sensor sees the line most of the time? Why?
2. Change the spin in the last **else** (motor B backward 24) to 60. What happens at the corners and dead ends?
3. Take out the middle **if** (line under the right sensor). Does the robot still finish? Is it faster or slower?
4. Count how many times the robot turns round at a dead end. Can you find a maze number with no dead ends on its way?

## Modify

1. Make it a **right-hand** robot: swap left and right everywhere. Does it still finish? Does it take the same way?
2. Make the robot faster. What is the fastest speed that still finishes maze 1?
3. Show a different picture when the robot is spinning.

## Make

In teams, **design a line maze** for another team on paper first: at least three junctions, two dead ends and a finish box. Build it on the floor with tape. Swap mazes and race. Before each run, predict: will the left-hand rule or the right-hand rule be faster in this maze? Write down the times.

## Teacher notes

- **Timing**: 15 min predict, 25 min run and build, 20 min investigate, 30 min modify and make.
- **Big idea**: an **algorithm** that always works. If all the lines of a maze are joined (no loops round the finish), keeping one hand on the wall, or one sensor on one edge of the line, visits every path until it finds the finish. It is not always the shortest way: learners can compare left-hand and right-hand times.
- **How the starter works**: the robot follows the line's **left edge**. Line under the left sensor: pivot left. Line under the right sensor only: turn gently right. No line: spin right until the left sensor finds the line again. At a junction the left sensor finds the left branch first, and at a dead end the robot spins until it finds the line coming back.
- **On screen**: all the Robot view's line mazes are joined, so the starter's rule finishes every maze number (the same rule is tested on 100 mazes). The time limit is 2 minutes.
- **Phase 3**: this lesson brings together the motors, the line sensors and the maze thinking from Bump maze. No new parts or wiring.
- **Electrical design check (CLAUDE.md §8)**: no new wiring; the robot is the one from Follow the line (2 × AA, 3 V, L9110S; sensors on the micro:bit's 3V). No coin cells, no mains.
- **Common problems**: the robot misses a junction (it is too fast: lower the speed); it spins for ever at a dead end (the line ends too close to the next line: leave 15 cm between lines); it turns the wrong way (the left and right sensor wires are swapped: swap them back).
- **Cost**: about R10 for a roll of insulation tape.
