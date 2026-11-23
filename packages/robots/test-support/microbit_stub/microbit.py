# A stand-in for the micro:bit's "microbit" module, for testing rfa_robot.py in CI. It records
# what the module does to pins; digital reads come from MICROBIT_SCENARIO {"reads": {"13": 1}}.
import json
import os

SCENARIO = json.loads(os.environ.get("MICROBIT_SCENARIO", "{}"))
TRACE = []


class _Pin:
    PULL_UP = 0
    PULL_DOWN = 1
    NO_PULL = 2

    def __init__(self, n):
        self.n = n

    def write_digital(self, value):
        TRACE.append(["digital", self.n, value])

    def write_analog(self, value):
        TRACE.append(["analog", self.n, value])

    def set_analog_period(self, ms):
        TRACE.append(["period", self.n, ms])

    def set_pull(self, pull):
        TRACE.append(["pull", self.n, pull])

    def read_digital(self):
        return SCENARIO.get("reads", {}).get(str(self.n), 0)


for _n in range(21):
    globals()["pin%d" % _n] = _Pin(_n)
