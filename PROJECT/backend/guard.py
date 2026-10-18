"""Input guard: requests the tool must not act on. Rules only, no model call."""
import re


def _r(p):
    return re.compile(p, re.I)


_VERB = r"(?:change|edit|alter|modify|delete|remove|rename|overwrite|update|insert|drop|rewrite|replace|add|erase|truncate)"
RULES = [
    ("injection", _r(r"ignore (?:all |any )?(?:previous|prior|above|earlier|your) (?:instructions|rules)|system prompt|reveal .{0,25}(?:instructions|prompt|rules)|you are now|pretend (?:to be|you)|jailbreak|developer mode|disregard (?:the|your|all)"),
     "I can't follow instructions that try to change how I work or reveal my setup. I only explain the uploaded document."),
    ("modify", _r(rf"^\s*(?:please\s+)?(?:(?:can|could|would) you\s+|i want you to\s+|go ahead and\s+|now\s+)?{_VERB}\b|\b(?:drop|truncate)\s+table\b|\bdelete\s+from\b"),
     "I'm not allowed to change, delete or rewrite anything: not the document, not its columns or fields, not my own settings. I can only read and explain it."),
    ("offline", _r(r"\b(?:email|e-mail|send|upload|share|post|forward|publish|sync)\b.{0,40}\b(?:to|online|cloud|server|internet|someone)\b|\b(?:search|google|browse|look up)\b.{0,20}\b(?:web|internet|online)\b"),
     "Everything here runs offline on this device. I can't send, share, upload or look things up online."),
    ("deception", _r(r"\b(?:forge|fake|backdate|falsif\w*|fabricat\w*|evade|cheat|scam)\b"),
     "I can't help with forging, falsifying or deceiving anyone. I can explain what the document actually says."),
    ("drafting", _r(r"^\s*(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:draft|write|create|generate|prepare)\b.{0,30}\b(?:agreement|contract|notice|letter|clause|email)\b"),
     "I explain documents that already exist. I don't draft, negotiate or write new legal text."),
    ("off_topic", _r(r"\b(?:write|generate|make)\b.{0,20}\b(?:code|program|script|poem|story|essay|joke|song)\b|\bweather\b|\brecipe\b|\btell me a joke\b|\bwho (?:is|was) the (?:president|prime minister)\b"),
     "That's outside what I do. I only explain the document you uploaded."),
]


def check(question):
    q = (question or "").strip()
    if len(q) < 3 or not re.search(r"\w", q):
        return ("empty", "I couldn't read a question there. Please ask something about the document.")
    if len(q) > 600:
        return ("too_long", "That's too long for me to read as one question. Please ask it in a sentence or two.")
    for cat, pat, msg in RULES:
        if pat.search(q):
            return (cat, msg)
    return None