# Runs a program with rfa_robot.py against the stub and prints the pin trace and results as JSON.
# Usage: MICROBIT_SCENARIO='{...}' python3 run.py <module dir> < main.py
import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "microbit_stub"))
sys.path.insert(0, sys.argv[1])
import microbit  # noqa: E402

scope = {"__name__": "__main__", "RESULTS": []}
exec(compile(sys.stdin.read(), "main.py", "exec"), scope)
print(json.dumps({"trace": microbit.TRACE, "results": scope["RESULTS"]}))
