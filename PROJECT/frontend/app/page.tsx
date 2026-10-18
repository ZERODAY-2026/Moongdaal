"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import Disclaimer from "./components/Disclaimer";
import SummaryCard from "./components/SummaryCard";
import RisksList, { FindingCard } from "./components/RisksList";
import QAChat from "./components/QAChat";
import { analyzeDocument, clearSession } from "./lib/api";
import type { Source } from "./lib/api";
import type { AnalysisResult } from "./lib/types";

const MAX_MB = 20;
const MIN_CHARS = 50;
const MAX_CHARS = 200000;

export default function Page() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [sourceName, setSourceName] = useState<string>("");
  const [pasted, setPasted] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  function validateFile(f: File): string | null {
    const n = f.name.toLowerCase();
    if (!n.endsWith(".pdf") && !n.endsWith(".txt")) {
      return "Unsupported file type. Please choose a PDF or TXT file, or switch to Paste text.";
    }
    if (f.size === 0) return "This file is empty.";
    if (f.size > MAX_MB * 1024 * 1024) {
      return `This file is larger than ${MAX_MB} MB.`;
    }
    return null;
  }

  function validateText(t: string): string | null {
    if (t.trim().length < MIN_CHARS) {
      return `Please paste at least ${MIN_CHARS} characters of text.`;
    }
    if (t.length > MAX_CHARS) {
      return `The text is longer than ${MAX_CHARS.toLocaleString()} characters.`;
    }
    return null;
  }

  async function analyze(src: Source) {
    const problem =
      src.kind === "file" ? validateFile(src.file) : validateText(src.text);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSourceName(src.kind === "file" ? src.file.name : "Pasted text");
    setLoading(true);
    setAnalysis(null);
    try {
      setAnalysis(await analyzeDocument(src));
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `Could not analyse the document: ${e.message}`
          : "Could not reach the local backend. Is it running?"
      );
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) analyze({ kind: "file", file: f });
  }

  function reset() {
    clearSession().catch(() => {
      /* backend may already be stopped; nothing to clear */
    });
    setSourceName("");
    setPasted("");
    setAnalysis(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const dropped = analysis?.dropped_unverified ?? 0;

  return (
    <>
      <header className="top">
        <div className="logo" aria-hidden="true">
          §
        </div>
        <h2>Private Legal Document Triage</h2>
      </header>

      <Disclaimer />

      <main className="wrap">
        {!analysis && (
          <section className="hero">
            <h1>Understand your legal document</h1>
            <p>
              Upload a PDF or TXT file, or paste the text of a rental
              agreement. Get plain-language explanations of key clauses, with
              every point linked to the exact passage.
            </p>

            <div className="tabs" role="tablist" aria-label="Input method">
              <button
                role="tab"
                aria-selected={mode === "file"}
                className={`tab${mode === "file" ? " active" : ""}`}
                onClick={() => {
                  setMode("file");
                  setError(null);
                }}
                disabled={loading}
              >
                Upload file
              </button>
              <button
                role="tab"
                aria-selected={mode === "text"}
                className={`tab${mode === "text" ? " active" : ""}`}
                onClick={() => {
                  setMode("text");
                  setError(null);
                }}
                disabled={loading}
              >
                Paste text
              </button>
            </div>

            {loading ? (
              <div className="drop">
                <div className="spinner" role="status" aria-label="Analysing" />
                <div>
                  Analysing <strong>{sourceName}</strong> on this device…
                </div>
                <div className="hint">
                  This can take 30 to 90 seconds, longer for large documents.
                </div>
              </div>
            ) : mode === "file" ? (
              <label
                className={`drop${dragOver ? " over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <span className="btn">Select file</span>
                <div className="hint">or drop a PDF or TXT file here</div>
                <div className="hint">Max {MAX_MB} MB · processed locally</div>
                <input
                  ref={inputRef}
                  className="sr"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) analyze({ kind: "file", file: f });
                  }}
                />
              </label>
            ) : (
              <div className="textbox">
                <label className="sr" htmlFor="pasted">
                  Paste document text
                </label>
                <textarea
                  id="pasted"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="Paste the document text here"
                />
                <div className="row">
                  <span className="hint">
                    {pasted.length.toLocaleString()} characters · processed
                    locally
                  </span>
                  <button
                    className="btn small"
                    onClick={() => analyze({ kind: "text", text: pasted })}
                    disabled={!pasted.trim()}
                  >
                    Analyse text
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="err" role="alert">
                {error}
              </div>
            )}
          </section>
        )}

        {analysis && (
          <>
            <div className="bar">
              <div>
                <span className="file">{sourceName}</span>{" "}
                <span className="hint">analysed locally</span>
              </div>
              <button className="btn small ghost" onClick={reset}>
                Start over / clear document
              </button>
            </div>

            <div className="grid">
              <div>
                {(analysis.truncated || dropped > 0) && (
                  <div className="err" role="status">
                    {analysis.truncated &&
                      "Results may be incomplete: the item limit was reached or part of the document could not be analysed. "}
                    {dropped > 0 &&
                      `${dropped} model-written item(s) were removed because their quote could not be verified in the document.`}
                  </div>
                )}

                <SummaryCard
                  summary={analysis.summary}
                  escalation={analysis.escalation}
                />
                <RisksList risks={analysis.risks} />

                <section className="card">
                  <h3>Key clauses explained</h3>
                  {analysis.findings.length === 0 ? (
                    <div className="empty">No key clauses were extracted.</div>
                  ) : (
                    analysis.findings.map((f, i) => (
                      <FindingCard key={`f-${f.chunk_id}-${i}`} f={f} />
                    ))
                  )}
                </section>
              </div>

              {/* key resets the chat when a new document is analysed */}
              <QAChat key={sourceName} />
            </div>
          </>
        )}
      </main>
    </>
  );
} 