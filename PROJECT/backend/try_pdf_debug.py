import sys
import pipeline

path = sys.argv[1]
data = open(path, "rb").read()
ch = pipeline.make_chunks(data, path)
lens = [len(t) for t in ch.values()]
print("chunks:", len(ch), "| shortest:", min(lens, default=0), "| longest:", max(lens, default=0))
for cid, t in list(ch.items())[:25]:
    print(cid, "|", t[:90])

res = pipeline.analyze(ch)
print("\nitems:", len(res["items"]), "| dropped:", res["dropped_unverified"], "| truncated:", res["truncated"])
for i in res["items"]:
    print(f"- {i['type']:11} {i['chunk_id']:8} {i['explanation'][:100]}")
