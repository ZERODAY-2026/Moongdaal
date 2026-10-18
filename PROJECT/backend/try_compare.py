import sys
import time

import pipeline

path = sys.argv[1]
ch = pipeline.make_chunks(open(path, "rb").read(), path)
found = {}
for flag in (False, True):
    pipeline.PREFILTER = flag
    t0 = time.time()
    res = pipeline.analyze(ch)
    found[flag] = {(i["chunk_id"], i["type"]) for i in res["items"]}
    print(f"prefilter={flag}: {time.time() - t0:.0f}s | items {len(res['items'])} | "
          f"analysed {res['chunks_analyzed']}/{res['chunks_total']} | dropped {res['dropped_unverified']}")
lost = found[False] - found[True]
print("items lost by prefilter:", len(lost))
for cid, typ in sorted(lost):
    print(" ", cid, typ, "|", ch[cid][:90])