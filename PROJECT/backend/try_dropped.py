import sys
import time
from collections import Counter

import pipeline
import safety

path = sys.argv[1]
ch = pipeline.make_chunks(open(path, "rb").read(), path)

reasons = Counter()
orig_filter = safety.filter_items


def spy_filter(items, chunks, require_type=False):
    for it in items or []:
        if not isinstance(it, dict):
            reasons["not a dict"] += 1
            continue
        cid = str(it.get("chunk_id", "")).strip().strip("[]")
        if cid not in chunks:
            reasons["bad chunk_id"] += 1
            print(f"BAD ID   | chunk_id={it.get('chunk_id')!r}")
        elif not safety.verify_quote(str(it.get("quote", "")), chunks[cid]):
            reasons["quote not verified"] += 1
        elif require_type and str(it.get("type", "")).strip().lower() not in safety.TYPES:
            reasons["bad type"] += 1
            print(f"BAD TYPE | type={it.get('type')!r}")
    return orig_filter(items, chunks, require_type)


safety.filter_items = spy_filter

t0 = time.time()
res = pipeline.analyze(ch)
print(f"\nitems: {len(res['items'])} | dropped: {res['dropped_unverified']} | truncated: {res['truncated']}")
print("drop reasons:", dict(reasons))
print(f"elapsed: {time.time() - t0:.0f}s")