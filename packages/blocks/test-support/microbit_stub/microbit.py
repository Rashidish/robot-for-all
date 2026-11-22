# A stand-in for the micro:bit's "microbit" module, used only by CI tests (M3 spec §9).
# It records what a generated program does (LEDs, scrolling, pins, pauses) so the trace can be
# compared with the interpreter's. Inputs (button presses, light level) come from SCENARIO.
import json
import os

SCENARIO = json.loads(os.environ.get("MICROBIT_SCENARIO", "{}"))
LIMIT_MS = SCENARIO.get("limit_ms", 3000)
TRACE = []
_time = [0]


class Stop(Exception):
    pass


def _record(*item):
    TRACE.append(list(item))


def sleep(ms):
    _record("sleep", ms)
    _time[0] += ms
    if _time[0] > LIMIT_MS:
        raise Stop()


def running_time():
    return _time[0]


def temperature():
    return SCENARIO.get("temperature", 21)


class _Image:
    def __getattr__(self, name):
        return name


Image = _Image()


class _Display:
    def show(self, image):
        _record("show", image)

    def scroll(self, text):
        _record("scroll", text)

    def clear(self):
        _record("clear")

    def read_light_level(self):
        return SCENARIO.get("light", 128)


display = _Display()


class _Button:
    def __init__(self, name):
        self.name = name
        self.seen = 0

    def _presses(self):
        return [t for t in SCENARIO.get("presses", {}).get(self.name, []) if t <= _time[0]]

    def was_pressed(self):
        count = len(self._presses())
        pressed = count > self.seen
        self.seen = count
        return pressed

    def is_pressed(self):
        return any(t <= _time[0] < t + 100 for t in SCENARIO.get("presses", {}).get(self.name, []))


button_a = _Button("A")
button_b = _Button("B")


class _Pin:
    def __init__(self, n):
        self.n = n

    def write_digital(self, value):
        _record("pin", self.n, value)


pin0, pin1, pin2 = _Pin(0), _Pin(1), _Pin(2)


class _Accelerometer:
    def get_x(self):
        return SCENARIO.get("x", 0)

    def get_y(self):
        return SCENARIO.get("y", 0)

    def get_z(self):
        return SCENARIO.get("z", -1024)


accelerometer = _Accelerometer()
