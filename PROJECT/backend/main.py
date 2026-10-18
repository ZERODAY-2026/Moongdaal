"""FastAPI application entry point."""

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pipeline
import safety

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE = {"chunks": {}}  # in memory only; single-user demo


class Question(BaseModel):
    question: str


@app.post("/analyze")
async def analyze(file: UploadFile):
    data = await file.read()  # never written to disk
    try:
        chunks = pipeline.make_chunks(data, file.filename or "")
    except Exception:
        raise HTTPException(400, "Could not read this file. Upload a text-based PDF or a .txt file.")
    if not chunks:
        raise HTTPException(400, "No readable text found. It may be a scanned PDF (OCR not enabled).")
    STATE["chunks"] = chunks

    try:
        result = await run_in_threadpool(pipeline.analyze, chunks)  # keeps the server responsive
    except Exception:
        raise HTTPException(503, "Could not reach the local model. Is Ollama running?")

    return {**result, "chunks": chunks, "disclaimer": safety.DISCLAIMER}


@app.post("/ask")
async def ask(q: Question):
    if not STATE["chunks"]:
        raise HTTPException(400, "Upload a document first.")

    if safety.is_verdict_question(q.question):
        return {"status": "refused", "answer": safety.ESCALATION,
                "evidence": [], "disclaimer": safety.DISCLAIMER}

    relevant = pipeline.find_relevant(q.question, STATE["chunks"])
    if not relevant:
        return {"status": "silent", "answer": safety.SILENT,
                "evidence": [], "disclaimer": safety.DISCLAIMER}

    try:
        result = await run_in_threadpool(pipeline.ask, q.question, relevant)
    except Exception:
        raise HTTPException(503, "Could not reach the local model. Is Ollama running?")

    if not result or not result.get("answer_found"):
        return {"status": "silent", "answer": safety.SILENT,
                "evidence": [], "disclaimer": safety.DISCLAIMER}

    evidence, _ = safety.filter_items(result.get("evidence", []), STATE["chunks"])
    for e in evidence:
        e.pop("explanation", None)
    if not evidence:  # no verifiable support, so the answer is not shown
        return {"status": "silent",
                "answer": safety.SILENT + " (No verifiable passage was found.)",
                "evidence": [], "disclaimer": safety.DISCLAIMER}

    return {"status": "answered", "answer": str(result.get("answer", "")),
            "evidence": evidence, "disclaimer": safety.DISCLAIMER}


@app.delete("/session")
async def clear():
    STATE["chunks"] = {}
    return {"cleared": True}