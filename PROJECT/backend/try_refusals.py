from safety import is_verdict_question as f

REFUSE = ["Is this enforceable?", "Can my landlord legally evict me?", "Will I win in court?",
          "Is this clause illegal?", "Is this agreement legally valid?", "Should I sign this?",
          "Can I sue the landlord for this?", "Is this clause void?", "Is this fair?"]
ANSWER = ["What is the notice period?", "How much is the security deposit?", "When is rent due?",
          "Who pays for maintenance?", "How long is the agreement valid?",
          "Which court has jurisdiction?", "What is the legal name of the landlord?",
          "What does the lock-in clause mean?", "Are pets allowed?"]
bad = 0
for q in REFUSE:
    ok = f(q) is True; bad += not ok; print("OK  " if ok else "FAIL", "refuse", q)
for q in ANSWER:
    ok = f(q) is False; bad += not ok; print("OK  " if ok else "FAIL", "answer", q)
print("failures:", bad)