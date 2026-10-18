"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pipeline
import safety


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

STATE = {"chunks": {}}  # in memory only; single-user demo


class Question(BaseModel):
    question: str


@app.post("/analyze")
async def analyze(file: UploadFile):
    data = await file.read()  # never written to disk
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

    return {**result, "chunks": chunks, "disclaimer": safety.DISCLAIMER,
            "ocr_pages": list(pipeline.OCR_PAGES)}


@app.post("/ask")
async def ask(q: Question):
    if not STATE["chunks"]:
        raise HTTPException(400, "Upload a document first.")

    if safety.is_verdict_question(q.question):
        return {"status": "refused", "answer": safety.ESCALATION,
                "evidence": [], "disclaimer": safety.DISCLAIMER}

    relevant = await run_in_threadpool(pipeline.find_relevant, q.question, STATE["chunks"])
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
        e["quote"] = pipeline.snap_quote(e["quote"], STATE["chunks"].get(e.get("chunk_id"), ""))
    if not evidence:  # no verifiable support, so the answer is not shown
        return {"status": "silent",
                "answer": safety.SILENT + " (No verifiable passage was found.)",
                "evidence": [], "disclaimer": safety.DISCLAIMER}

    return {"status": "answered", "answer": str(result.get("answer", "")),
            "reasoning": str(result.get("reasoning", "")),
            "evidence": evidence, "disclaimer": safety.DISCLAIMER}


@app.delete("/session")
async def clear():
    STATE["chunks"] = {}
    pipeline.clear_cache()
    pipeline.OCR_PAGES.clear()
    return {"cleared": True}