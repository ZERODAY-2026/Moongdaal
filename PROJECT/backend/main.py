"""FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(title="Legal Triage")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
