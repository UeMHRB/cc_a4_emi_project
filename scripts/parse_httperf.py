"""Print one CSV row from an httperf report: replicas,rate,avg_resp_ms,errors,replies_2xx,requests_sent."""
import re
import sys

path, replicas, rate = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()


def grab(pattern, default="0"):
    m = re.search(pattern, text)
    return m.group(1) if m else default


avg = grab(r"Reply time \[ms\]: response ([\d.]+)")
sent = int(grab(r"Total: connections \d+ requests (\d+)"))
replies = int(grab(r"Total: connections \d+ requests \d+ replies (\d+)"))
ok = int(grab(r"Reply status: 1xx=\d+ 2xx=(\d+)"))
errors = int(grab(r"Errors: total (\d+)")) + (replies - ok)
print(f"{replicas},{rate},{avg},{errors},{ok},{sent}")
