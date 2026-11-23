# Stand-in for the simulator's _rfa_sim module (patch 0005): records calls; reads come from
# MICROBIT_SCENARIO {"sensors": {"line_left": 1}}.
import json
import os

import microbit

SENSORS = json.loads(os.environ.get("MICROBIT_SCENARIO", "{}")).get("sensors", {})


def call(name, value):
    microbit.TRACE.append(["call", name, value])


def read(name):
    return SENSORS.get(name, 0)
