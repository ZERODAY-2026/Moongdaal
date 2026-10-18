import re
import sys

import pipeline
import safety

path = sys.argv[1]
ch = pipeline.make_chunks(open(path, "rb").read(), path)

# (question, regex that matches the clause in the document that answers it)
CASES = [
    ("Can I keep a dog?", r"pet|animal"),
    ("What happens if I stop paying on time?", r"rent|interest|terminat"),
    ("Who fixes a broken tap?", r"repair"),
    ("Can my cousin move in with me?", r"sublet|share"),
    ("How much will I get back when I leave?", r"deposit"),
]

for q, pat in CASES:
    if safety.is_verdict_question(q):
        print("REFUSED               |", q)
        continue
    doc_ids = [c for c, t in ch.items() if re.search(pat, t, re.I)]
    if not doc_ids:
        print("REGEX MATCHES NOTHING |", q)
        continue
    rel = pipeline.find_relevant(q, ch)
    if not [c for c in rel if c in doc_ids]:
        print(f"RETRIEVAL MISS        | {q}\n   clause in {doc_ids[:5]}, retrieved {list(rel)}")
        continue
    res = pipeline.ask(q, rel) or {}
    raw = res.get("evidence") or []
    kept, _ = safety.filter_items(raw, ch)
    if not res.get("answer_found"):
        tag = "MODEL SAID NOT FOUND"
    elif raw and not kept:
        tag = "EVIDENCE DROPPED"
    elif not kept:
        tag = "NO EVIDENCE GIVEN"
    else:
        tag = "OK"
    print(f"{tag:21} | {q} | retrieved {len(rel)}, evidence raw {len(raw)} kept {len(kept)}")