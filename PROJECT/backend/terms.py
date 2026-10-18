"""Plain-language glossary and 'what does X mean' detection. Offline."""
import re

GLOSSARY = {
    "security deposit": "Money paid upfront that the landlord holds as protection against unpaid rent or damage. It is meant to come back when the tenancy ends, minus valid deductions.",
    "lock in period": "A fixed stretch at the start during which you can't leave without the other side's agreement or a cost.",
    "notice period": "How long before ending the agreement you must tell the other side in writing.",
    "indemnity": "A promise to cover the other side's losses or costs if something specific goes wrong.",
    "force majeure": "A clause that excuses someone from their duties when something outside anyone's control happens, like a flood or war.",
    "arbitration": "Settling a dispute through a private neutral person (an arbitrator) instead of going to court.",
    "jurisdiction": "Which court or region's law decides disputes about this document.",
    "subletting": "A tenant renting out all or part of the place to someone else.",
    "liquidated damages": "A fixed amount agreed in advance that one side pays if it breaks a specific promise.",
    "probation": "An initial trial period in a job, when the employer checks the fit and some terms can differ.",
    "non compete": "A promise not to work for a competitor or start a competing business for a set time.",
    "confidentiality": "A promise not to share certain information with outsiders.",
    "waiver": "Deliberately giving up a right. Giving up one right once doesn't automatically give up others.",
    "credit score": "A number (in India usually 300 to 900) that summarises how reliably you have repaid loans and credit cards. Lenders use it to decide whether to lend to you and at what interest rate.",
    "emi": "Equated Monthly Instalment: a fixed amount you pay each month to repay a loan, covering both the amount borrowed and the interest.",
    "principal": "The original amount borrowed, before interest.",
    "collateral": "Something valuable, like a house or gold, pledged to the lender that they can take if the loan isn't repaid.",
    "guarantor": "A person who promises to repay the loan if the borrower can't.",
    "lessor": "The landlord, the person who rents the property out.",
    "lessee": "The tenant, the person who rents the property.",
}
ALIASES = {"lockin": "lock in period", "lock in": "lock in period", "deposit": "security deposit", "sublet": "subletting",
           "sublease": "subletting", "noncompete": "non compete", "cibil score": "credit score", "cibil": "credit score",
           "damages": "liquidated damages", "notice": "notice period"}

_CUE = re.compile(r"\b(mean|means|meaning|define|definition|stands? for|layman|simple (?:words|terms)|in plain|eli5|jargon)\b", re.I)
_EXTRACT = re.compile(
    r"(?:what(?:'s| is| are| does| do)|define|explain|meaning of|tell me about)\s+(?:the\s+|a\s+|an\s+)?(?:term\s+|word\s+|phrase\s+)?[\"']?(.+?)[\"']?"
    r"(?:\s+(?:mean|means|stand for|stands for)|\s+in (?:simple|plain|layman)\S*.*)?\s*\??$", re.I)


def _norm(s):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("-", " ")).split())


def lookup(term):
    t = _norm(term)
    if t in GLOSSARY:
        return t
    if t in ALIASES:
        return ALIASES[t]
    for k in sorted(GLOSSARY, key=len, reverse=True):
        if k in t:
            return k
    return None


def term_question(q):
    m = _EXTRACT.search((q or "").strip())
    if not m:
        return None
    term = m.group(1).strip(" ?.\"'")
    if not term or len(term.split()) > 5:
        return None
    key = lookup(term)
    return (term, key) if (key or _CUE.search(q)) else None