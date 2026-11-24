---
id: p2-maze-01
title: Bump maze
phase: 2
grades: [6, 7]
mechanism: sensor-control
syllabus_links:
  - subject: Coding and Robotics (CAPS, Intermediate Phase)
    topic: Algorithms and coding - a loop with an if ... else decision that solves a problem step by step (to confirm)
  - subject: Mathematics (CAPS, Intermediate Phase)
    topic: Space and shape - position and movement; turns and directions on a grid (to confirm)
  - subject: Natural Sciences and Technology (CAPS, Intermediate Phase)
    topic: Structures - folding card to make a strong, stable shape (to confirm)
duration_minutes: 90
cost_estimate_zar: 5
parts:
  - { item: phone, tablet or computer with the Robots For All code editor, qty: 1 }
  - { item: the whisker robot from Whisker bumper, qty: 1, substitute: the on-screen robot in the Robot view }
  - { item: cardboard boxes for the course walls, qty: 4, substitute: cereal boxes }
  - { item: masking tape or Prestik, qty: 1 }
  - { item: scissors, qty: 1 }
  - { item: a dark koki or paint for the tunnel roof, qty: 1 }
  - { item: straw for the gate hinge, qty: 1, substitute: a pencil or a skewer with the point cut off }
outcomes:
  - Program a robot that finds its way out of a maze using only touch
  - Explain why a simple bump-and-turn robot can go round in circles, and how hugging a wall helps
  - Build a maze course from folded card wall pieces
concepts: [maze, algorithm, wall follower, loop, if else, test, improve]
safety:
  adult_help: true
  notes:
    - Use only AA batteries in holders (3 V). Never use coin or button cells - they are very dangerous if swallowed
    - Never connect anything to a wall plug (mains electricity)
    - An adult cuts thick cardboard; learners cut thin card with scissors
    - Build the course on the floor away from stairs and doorways, so nobody trips over the walls
starter_program: bump-maze
world: bump-maze
hardware: microbit-motor
assessment:
  - I can explain what my robot does when a whisker touches a wall
  - I can explain why curving towards one wall helps the robot get out of a maze
  - I can build a wall piece that stands up by itself
  - I can change one number, test again and say whether it helped
prerequisites: [p2-whisker-01]
next: null
templates: [wall-pieces, tunnel-and-gate]
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict

Your whisker robot can feel a wall. Can it find its way **out of a maze** using only touch? An **algorithm** is a set of steps that solves a problem. One old maze algorithm is: keep one hand on a wall and keep walking.

![A wall piece and the wall-hugger idea. Left: a wall piece seen from the end (1) with its base folded into an L (2) so it stands by itself. Right: a maze corridor seen from above. The robot curves gently left until it touches the wall (3), then backs up and turns right (4), and curves left again.](./images/wall-hugger.svg)

1. **Wall piece**: 200 mm long, 60 mm high
2. **Base** folded into an L, taped to the floor
3. **Curve left** until a whisker touches the wall
4. **Back up, turn right**, and curve left again

Open the starter program. Talk with a partner:

- What do the two motors do when no whisker is pressed? Why is motor A slower than motor B?
- What happens when a whisker touches a wall? In what order?
- Do you think the robot will get out of the maze? How long will it take?

## Run

1. Tap **Run**. In the **Robot** view the robot curves left, bumps, backs up and turns right, again and again, until it reaches the finish. Watch the time and the number of wall touches.
2. Try another **maze number**. Does the same program get out of every maze?
3. **With real parts:** print the wall piece stencil once and trace it onto cereal-box card for each wall. Cut, fold the base into an L, and tape the bases to the floor. **Print course** in the Robot view gives a build sheet that says where each wall goes.
4. Send the program to your robot, put it at the start and let it go.

## Investigate

1. Change motor A in the **else** part to 60, the same as motor B. Run it again. What happens now? Why does a robot that only bumps and turns sometimes go round and round?
2. What does the 300 ms pause do? What happens with 100 ms?
3. What happens if the turn pause is 1000 ms instead of 500? Is the robot faster or slower to finish?
4. Count the wall touches in the result. Which change made fewer touches?

## Modify

1. Make the robot hug the **right** wall instead: curve right, and turn left after a bump.
2. Find the slowest motor A speed that still gets out of the maze. Find the fastest.
3. Show a different picture on the display while the robot is backing up.

## Make

Build a **real bump maze** with your class: at least six wall pieces and a finish box. Then add a **tunnel**: two walls 150 mm apart with the dark roof from the template on top. Hang the **gate flap** across a corridor so the robot has to push through it.

Race your robots through the same maze. Change one number, race again, and write down what you changed and whether it helped.

## Teacher notes

- **Timing**: 15 min predict, 25 min run on screen and build walls, 20 min investigate, 30 min modify and make.
- **Big idea**: a robot that only bumps and turns by the same amount can repeat the same moves for ever. Curving gently towards one wall keeps the robot close to that wall, like a hand on the wall. This **wall follower** gets out of any maze where the walls are all joined (all the Robot view mazes are like this). Learners do not need the proof; it is enough that they test it on many maze numbers.
- **On screen**: the starter gets out of the default bump maze in about 35 seconds. Some maze numbers take longer; the time limit is 2 minutes.
- **The course**: the wall pieces are a stencil, so one printed sheet makes every wall. Join two pieces with the end tab for a 400 mm wall. The tunnel roof is in two halves to fit A4; colour the inside dark so the tunnel is dark for a light-sensor robot later. The gate flap's hinge tab wraps round a straw laid across the tops of two walls; the flap hangs to the floor and swings up when the robot pushes it.
- **Electrical design check (CLAUDE.md §8)**: no new wiring; the robot is the one from Whisker bumper (2 × AA, 3 V, L9110S; whiskers on the micro:bit's own 3 V). No coin cells, no mains.
- **Common problems**: the robot spins in a corner (make the turn pause shorter); it scrapes along a wall without the whisker noticing (bend the whiskers further out to the side); the walls fall over (tape the folded base to the floor, or put a small stone on it).
- **Cost**: about R5 for tape; walls are made from boxes the class collects.
