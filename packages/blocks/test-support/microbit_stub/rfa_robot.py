# A stand-in for rfa_robot.py (ADR-0008) in the equivalence tests: it records robot calls in the
# same trace as the stub micro:bit, so they can be compared with the interpreter's.
from microbit import TRACE


def motor(side, speed):
    TRACE.append(["robot", "motor", side, int(speed)])


def stop():
    TRACE.append(["robot", "stop"])
