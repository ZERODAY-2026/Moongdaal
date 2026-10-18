"""Safety test cases."""

from safety import filter_items, is_verdict_question, verify_quote

CHUNKS = {"P1-C0": "The tenant shall pay rent of Rs. 15,000 on or before the 5th of each month."}


def test_real_quote_passes():
    assert verify_quote("pay rent of Rs. 15,000 on or before the 5th", CHUNKS["P1-C0"])


def test_fake_quote_rejected():
    assert not verify_quote("The landlord may evict without notice", CHUNKS["P1-C0"])


def test_wrong_chunk_rejected():
    kept, dropped = filter_items([{"chunk_id": "P9-C9", "quote": "pay rent of Rs. 15,000"}], CHUNKS)
    assert kept == [] and dropped == 1


def test_curly_quotes_and_spacing_tolerated():
    chunk = "The Tenant\u2019s deposit  is refundable."
    assert verify_quote("Tenant's deposit is refundable", chunk)


def test_verdict_questions_refused():
    assert is_verdict_question("Is this clause enforceable?")
    assert is_verdict_question("Is this legal in Karnataka?")


def test_normal_question_allowed():
    assert not is_verdict_question("When is rent due?")