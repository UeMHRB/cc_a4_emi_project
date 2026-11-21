"""Generate an httperf --wsesslog file: one POST /api/emi per session, random valid inputs."""
import json
import random
import sys

count = int(sys.argv[1])
for _ in range(count):
    body = json.dumps({
        "principal": random.randint(10000, 5000000),
        "rate": round(random.uniform(1, 30), 2),
        "months": random.randint(6, 360),
    }, separators=(",", ":"))
    print(f"/api/emi method=POST contents='{body}'")
    print()  # a blank line separates sessions
