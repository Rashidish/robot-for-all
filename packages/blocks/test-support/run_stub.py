# Runs a generated MicroPython program against the stub and prints its trace as JSON.
# Usage: MICROBIT_SCENARIO='{...}' python3 run_stub.py < main.py
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "microbit_stub"))
import microbit  # noqa: E402

source = sys.stdin.read()
error = None
try:
    exec(compile(source, "main.py", "exec"), {"__name__": "__main__"})
except microbit.Stop:
    pass
except ZeroDivisionError:
    error = "divide_by_zero"
print(json.dumps({"trace": microbit.TRACE, "error": error}))
