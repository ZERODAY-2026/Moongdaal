"""Quote verification and refusal/escalation rules."""

import re
import unicodedata

DISCLAIMER = (
    "This is a preliminary explanation of the document's text. It is not legal "
    "advice and cannot decide whether anything is valid or enforceable."
)

ESCALATION = (
    "I can't say whether this is legal, valid or enforceable. That depends on "
    "your jurisdiction and the full facts. A qualified lawyer or a local tenant "
    "or consumer advice service can help. You could ask them: 'Is this clause "
    "valid where I live, and what are my options?'"
)

SILENT = "The document does not appear to address this."

TYPES = {"obligation", "right", "deadline", "penalty", "termination", "concern"}

# Verdict phrasing only. Plain words like "valid for 11 months" or "court of jurisdiction"
# are ordinary document questions and must NOT be refused.
REFUSE_PATTERNS = [
    r"enforceab",
    r"\blegally\b",
    r"\billegal\b",
    r"\bunlawful\b",
    r"\b(is|are|was|would|could|does)\b[^?]{0,40}\blawful\b",
    r"\b(is|are|was|would|could)\b[^?]{0,40}\blegal\b(?!\s+(name|notice|heir|heirs|fees?|charges|representative|address|owner))",
    r"\blegal validity\b",
    r"\b(valid|invalid|void|voidable|binding)\b[^?]{0,15}\b(in|under|before) (law|court)\b",
    r"\bis (this|that|it|the \w+) (agreement|contract|clause|term|rule)?\s*(void|voidable|invalid)\b",
    r"\bsue\b",
    r"\bin court\b",
    r"\bto court\b",
    r"\bwill i (win|lose)\b",
    r"\bshould i sign\b",
    r"\bloophole",
    r"\bis (this|that|it) (fair|safe|ok|okay|a scam|a good deal|legit)\b",
]


def is_verdict_question(question: str) -> bool:
    q = (question or "").lower()
    return any(re.search(p, q) for p in REFUSE_PATTERNS)


_REPLACE = {
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2013": "-", "\u2014": "-", "\u00a0": " ",
}


def norm(text: str) -> str:
    # NFKC also expands PDF ligatures like "fi" and "fl"
    text = unicodedata.normalize("NFKC", text or "")
    for bad, good in _REPLACE.items():
        text = text.replace(bad, good)
    return re.sub(r"\s+", " ", text).strip().lower()


_norm = norm  # keeps older imports and tests working

def _squash(text: str) -> str:
    """Normalise, then drop all whitespace so lost or extra spaces can't cause a false drop."""
    return re.sub(r"\s+", "", norm(text))


def verify_quote(quote: str, chunk_text: str) -> bool:
    """True only if the quote really appears in the chunk it cites (whitespace-insensitive)."""
    q = _squash(quote)
    if len(q) < 8:  # too short to count as evidence
        return False
    return q in _squash(chunk_text)


def filter_items(items, chunks: dict, require_type: bool = False):
    """Keep only items whose quote is verified. Returns (kept, dropped_count).

    With require_type=True the item needs a valid type, and the label is set from the
    type in code (concern only if type == "concern"), so the model cannot mislabel."""
    kept, dropped = [], 0
    for it in items or []:
        if not isinstance(it, dict):
            dropped += 1
            continue
        cid = str(it.get("chunk_id", "")).strip().strip("[]")
        if cid not in chunks or not verify_quote(str(it.get("quote", "")), chunks[cid]):
            dropped += 1
            continue
        if require_type:
            typ = str(it.get("type", "")).strip().lower()
            typ = TYPE_ALIASES.get(typ, typ)
            if typ not in TYPES:
                dropped += 1
                continue
            it["type"] = typ
            it["label"] = "concern" if typ == "concern" else "stated"
        else:
            it["label"] = "concern" if it.get("label") == "concern" else "stated"
        it["chunk_id"] = cid
        it["explanation"] = str(it.get("explanation", "")).strip()
        kept.append(it)
    return kept, dropped
  


# Model sometimes invents near-synonyms of the allowed types. Map them in code.
TYPE_ALIASES = {
    "restriction": "obligation",
    "prohibition": "obligation",
    "responsibility": "obligation",
    "duty": "obligation",
}

_VERDICT_OUT = re.compile(
    r"enforceab|\billegal|\bunlawful|\blegally (valid|binding)|\b(void|voidable|invalid)\b", re.I
)


def strip_verdicts(text: str) -> str:
    """Drop sentences in model-written text that sound like legal verdicts."""
    parts = re.split(r"(?<=[.!?])\s+", text or "")
    return " ".join(p for p in parts if not _VERDICT_OUT.search(p)).strip()