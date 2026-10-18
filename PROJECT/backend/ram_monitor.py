"""Records peak RAM of ollama and python processes. Numbers only, no document text."""
import csv
import sys
import time

import psutil

ME = psutil.Process().pid
GROUPS = {"ollama": "ollama", "python": "python"}  # label -> substring of process name
peak = {"ollama": 0, "python": 0, "total": 0, "system_used": 0}
secs = float(sys.argv[1]) if len(sys.argv) > 1 else None  # optional auto-stop in seconds


def sample():
    now = {"ollama": 0, "python": 0}
    for p in psutil.process_iter(["pid", "name", "memory_info"]):
        try:
            if p.info["pid"] == ME:
                continue  # don't count this monitor
            name = (p.info["name"] or "").lower()
            for label, sub in GROUPS.items():
                if sub in name:
                    now[label] += p.info["memory_info"].rss
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    now["total"] = now["ollama"] + now["python"]
    now["system_used"] = psutil.virtual_memory().used
    return now


start = time.time()
print("Monitoring. Upload your file now. Press Ctrl+C when done." if not secs else f"Monitoring for {secs}s...")
with open("ram_log.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["sec", "ollama_mb", "python_mb", "total_mb", "system_used_mb"])
    try:
        while secs is None or time.time() - start < secs:
            s = sample()
            for k in peak:
                peak[k] = max(peak[k], s[k])
            w.writerow([round(time.time() - start, 1)] + [round(s[k] / 2**20) for k in ("ollama", "python", "total", "system_used")])
            f.flush()
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass

print("\nPeak RAM (MB)")
for k, v in peak.items():
    print(f"  {k:12}: {v / 2**20:,.0f}")
print(f"  run time    : {time.time() - start:.0f} s   (full log in ram_log.csv)")