import json
import pipeline

data = open(r"..\samples\rental_sample.txt", "rb").read()
ch = pipeline.make_chunks(data, "x.txt")
print("chunks:", len(ch))
for cid, t in ch.items():
    print(cid, "|", t[:70])

r = pipeline._call(pipeline.MAP_PROMPT.replace("{BODY}", pipeline._format(ch)))
print(json.dumps(r, indent=1)[:3000])