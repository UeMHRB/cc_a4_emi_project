"""Profile the cluster during a run.
Usage: profile.py <output-prefix>
Writes <prefix>.host_cpu.csv (every 1 s) and <prefix>.pods.csv (every 15 s).
Stops cleanly on SIGTERM or SIGINT."""
import csv
import os
import signal
import subprocess
import sys
import threading
from datetime import datetime

import psutil

prefix = sys.argv[1]
os.makedirs(os.path.dirname(prefix) or ".", exist_ok=True)
stop = threading.Event()
signal.signal(signal.SIGTERM, lambda *_: stop.set())
signal.signal(signal.SIGINT, lambda *_: stop.set())


def now():
    return datetime.now().isoformat(timespec="seconds")


def host_cpu():
    with open(prefix + ".host_cpu.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "cpu_percent"])
        psutil.cpu_percent(None)  # prime the counter
        while not stop.wait(1):
            w.writerow([now(), psutil.cpu_percent(None)])
            f.flush()


def pod_usage():
    with open(prefix + ".pods.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "pod", "cpu_millicores", "memory_mi"])
        while True:
            ts = now()
            out = subprocess.run(["kubectl", "top", "pods", "-n", "emi", "--no-headers"],
                                 capture_output=True, text=True).stdout
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 3:
                    w.writerow([ts, parts[0], parts[1].rstrip("m"), parts[2].rstrip("Mi")])
            f.flush()
            if stop.wait(15):
                break


threads = [threading.Thread(target=host_cpu), threading.Thread(target=pod_usage)]
for t in threads:
    t.start()
for t in threads:
    t.join()
