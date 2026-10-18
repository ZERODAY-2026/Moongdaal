import sys
import time

import pipeline

path = sys.argv[1]
ch = pipeline.make_chunks(open(path, "rb").read(), path)
pipeline.CALL_LOG.clear()
t0 = time.time()
res = pipeline.analyze(ch)
print(f"total {time.time() - t0:.0f}s | chunks {len(ch)} | items {len(res['items'])} | dropped {res['dropped_unverified']}")
for i, c in enumerate(pipeline.CALL_LOG):
    print(i, c)
print("sum out_tok:", sum(c["out_tok"] or 0 for c in pipeline.CALL_LOG))