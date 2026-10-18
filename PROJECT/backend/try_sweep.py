import sys
import time

import pipeline

path = sys.argv[1]
ch = pipeline.make_chunks(open(path, "rb").read(), path)
cand = {c for c, t in ch.items() if pipeline.is_candidate(t)}
print(f"chunks {len(ch)} | prefilter candidates {len(cand)}")
print("sample of chunks the prefilter SKIPS (check none are real clauses):")
for c in [c for c in ch if c not in cand][:20]:
    print(" ", c, "|", ch[c][:80])

# (prefilter, batch chars)
for prefilter, size in [(True, 1500), (True, 2500), (True, 5000), (False, 2500)]:
    pipeline.PREFILTER = prefilter
    pipeline.BATCH_CHARS = size
    t0 = time.time()
    res = pipeline.analyze(ch)
    model_items = [i for i in res["items"] if not i["explanation"].startswith("Vague wording")]
    covered = {i["chunk_id"] for i in model_items} & cand
    print(
        f"prefilter={prefilter} batch={size}: {time.time() - t0:.0f}s | items {len(res['items'])} "
        f"| dropped {res['dropped_unverified']} | candidate chunks with a model item {len(covered)}/{len(cand)}"
    )