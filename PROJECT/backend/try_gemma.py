import pipeline, safety

text = b"""The tenant shall pay rent of Rs. 15,000 on or before the 5th of each month.

The landlord may deduct reasonable charges from the security deposit at the end of the tenancy.

Either party may terminate this agreement by giving thirty days written notice."""

chunks = pipeline.make_chunks(text, "test.txt")
print("CHUNKS:", chunks)

result = pipeline.analyze(chunks)
print("RAW MODEL OUTPUT:", result)

items, dropped = safety.filter_items(result.get("items", []), chunks)
print("VERIFIED ITEMS:", items)
print("DROPPED:", dropped)

q = pipeline.ask("When is rent due?", pipeline.find_relevant("When is rent due?", chunks))
print("ASK:", q)