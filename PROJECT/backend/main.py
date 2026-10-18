"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pipeline
import safety

import hashlib

import re
import guard
import terms

CACHE = {}  # sha256 of file bytes -> parsed and analysed result. RAM only, cleared on restart.
CACHE_MAX = 3


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(run_in_threadpool(pipeline.warm))  # load the model without blocking startup
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE = {"chunks": {}, "items": []}  # in memory only; single-user demo
OVERVIEW = re.compile(r"\b(contradict\w*|conflict\w*|inconsisten\w*|ambigu\w*|unclear|vague|red flags?|one.sided|loopholes?|concerns?|problems?|anything (?:odd|unusual|suspicious))\b", re.I)


class Question(BaseModel):
    question: str


@app.post("/analyze")
async def analyze(file: UploadFile):
    data = await file.read()  # never written to disk
    key = hashlib.sha256(data).hexdigest()
    if key in CACHE:
        hit = CACHE[key]
        STATE["chunks"] = hit["chunks"]
        pipeline.clear_cache()
        try:  # embeddings are rebuilt, which takes seconds and is cheaper than a Gemma pass
            await run_in_threadpool(pipeline._chunk_vectors, hit["chunks"])
        except Exception:
            pass
        return {**hit["result"], "chunks": hit["chunks"], "disclaimer": safety.DISCLAIMER,
                "ocr_pages": hit["ocr_pages"], "cached": True}
    try:
        chunks = await run_in_threadpool(pipeline.make_chunks, data, file.filename or "")
    except pipeline.OCRUnavailable as e:
        raise HTTPException(400, str(e))
    except Exception:
        raise HTTPException(400, "Could not read this file. Upload a PDF or a .txt file.")
    if not chunks:
        raise HTTPException(400, "No readable text found in this file.")
    STATE["chunks"] = chunks
    pipeline.clear_cache()

    try:
        result = await run_in_threadpool(pipeline.analyze, chunks)  # keeps the server responsive
    except Exception:
        raise HTTPException(503, "Could not reach the local model. Is Ollama running?")

    try:  # embed now so the first /ask is fast; keyword search still works if this fails
        await run_in_threadpool(pipeline._chunk_vectors, chunks)
    except Exception:
        pass

    ocr_pages = list(pipeline.OCR_PAGES)
    if not result["truncated"]:  # cache only complete runs
        if len(CACHE) >= CACHE_MAX:
            CACHE.pop(next(iter(CACHE)))  # drop the oldest
        CACHE[key] = {"chunks": chunks, "result": result, "ocr_pages": ocr_pages}
    return {**result, "chunks": chunks, "disclaimer": safety.DISCLAIMER,
            "ocr_pages": ocr_pages, "cached": False}

@app.post("/ask")
async def ask(q: Question):
    if not STATE["chunks"]:
        raise HTTPException(400, "Upload a document first.")
    base = {"evidence": [], "disclaimer": safety.DISCLAIMER}

    g = guard.check(q.question)  # edits, injection, off-topic, empty...
    if g:
        return {"status": "refused", "category": g[0], "answer": g[1], **base}

    if safety.is_verdict_question(q.question):
        return {"status": "refused", "category": "verdict", "answer": safety.ESCALATION, **base}

    if OVERVIEW.search(q.question) and STATE["items"]:  # answered from the analysis, no model call
        concerns = [i for i in STATE["items"] if i["type"] == "concern"]
        conf = [i for i in concerns if i["explanation"].startswith("Possible conflict")]
        if not concerns:
            return {"status": "answered", "answer": "I did not find vague, one-sided or conflicting wording. That does not prove there is none.", **base}
        ev = []
        for i in concerns[:8]:
            ev.append({"chunk_id": i["chunk_id"], "quote": i["quote"], "label": "concern", "explanation": i["explanation"]})
            if i.get("related_quote"):
                ev.append({"chunk_id": i["related_chunk_id"], "quote": i["related_quote"], "label": "concern",
                           "explanation": "The other passage in this possible conflict."})
        return {"status": "answered", "kind": "overview",
                "answer": f"I found {len(conf)} possible conflict(s) and {len(concerns) - len(conf)} vague or one-sided wording issue(s). Each is quoted below. These are flags to check, not legal conclusions.",
                "evidence": ev, "disclaimer": safety.DISCLAIMER}

    t = terms.term_question(q.question)
    if t:
        term, key = t
        near = await run_in_threadpool(pipeline.find_relevant, term, STATE["chunks"], 4)
        try:
            res = await run_in_threadpool(pipeline.explain_term, term, terms.GLOSSARY.get(key) if key else None, near)
        except Exception:
            raise HTTPException(503, "Could not reach the local model. Is Ollama running?")
        res = res or {}
        meaning = terms.GLOSSARY.get(key) or str(res.get("meaning", "")).strip()
        if meaning:
            evidence = []
            if res.get("in_document"):
                evidence, _ = safety.filter_items(res.get("evidence", []), STATE["chunks"])
            for e in evidence:
                e.pop("explanation", None)
                e["quote"] = pipeline.snap_quote(e["quote"], STATE["chunks"].get(e.get("chunk_id"), ""))
            here = str(res.get("in_this_document", "")).strip() if evidence else ""
            answer = meaning + (f" In this document: {here}" if here else " This document does not mention it.")
            answer += " (The plain meaning is a general explanation, not a quote from the document.)"
            return {"status": "answered", "kind": "definition", "answer": answer,
                    "evidence": evidence, "disclaimer": safety.DISCLAIMER}

    relevant = await run_in_threadpool(pipeline.find_relevant, q.question, STATE["chunks"])
    if not relevant:
        return {"status": "silent", "answer": safety.SILENT, **base}

    try:
        result = await run_in_threadpool(pipeline.ask, q.question, relevant)
    except Exception:
        raise HTTPException(503, "Could not reach the local model. Is Ollama running?")

    if not result or not result.get("answer_found"):
        return {"status": "silent", "answer": safety.SILENT, **base}

    evidence, _ = safety.filter_items(result.get("evidence", []), STATE["chunks"])
    for e in evidence:
        e.pop("explanation", None)
        e["quote"] = pipeline.snap_quote(e["quote"], STATE["chunks"].get(e.get("chunk_id"), ""))
    if not evidence:
        return {"status": "silent", "answer": safety.SILENT + " (No verifiable passage was found.)", **base}

    return {"status": "answered", "answer": str(result.get("answer", "")),
            "reasoning": str(result.get("reasoning", "")),
            "evidence": evidence, "disclaimer": safety.DISCLAIMER}

@app.delete("/session")
async def clear():
    STATE["chunks"] = {}
    STATE["items"] = []
    CACHE.clear()
    pipeline.clear_cache()
    pipeline.OCR_PAGES.clear()
    return {"cleared": True}