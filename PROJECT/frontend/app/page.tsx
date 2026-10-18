"use client";

import { useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_MB = 20;
const MIN_CHARS = 50;
const MAX_CHARS = 200000;

type Kind = "explicit" | "interpretation" | "concern";

type Finding = {
  quote: string;
  chunk_id: string;
  page: number | null;
  explanation: string;
  kind: Kind;
  confidence?: number | string;
  escalate?: boolean;
};

type Analysis = {
  summary: string;
  findings: Finding[];
  risks: Finding[];
  escalation?: string;
};

type AskResponse = {
  status: "answered" | "silent" | "refused" | "error";
  answer: string;
  findings: Finding[];
  escalation?: string;
};

type Msg = {
  role: "user" | "assistant";
  text: string;
  status?: AskResponse["status"];
  findings?: Finding[];
  escalation?: string;
};

type Source = { kind: "file"; file: File } | { kind: "text"; text: string };

const KIND_LABEL: Record<Kind, string> = {
  explicit: "Stated in document",
  interpretation: "Possible interpretation",
  concern: "Possible concern",
};

const STATUS_LABEL: Record<AskResponse["status"], string> = {
  answered: "Answer from the document",
  silent: "The document does not address this",
  refused: "Cannot give a verdict",
  error: "Error",
};

const SUGGESTIONS = [
  "What are the termination conditions?",
  "What penalties or fees apply?",
  "What are my obligations and deadlines?",
  "Is this enforceable?",
];

function FindingCard({ f }: { f: Finding }) {
  return (
    <div className="finding">
      <div className="head">
        <span className={`badge b-${f.kind}`}>{KIND_LABEL[f.kind]}</span>
        {f.escalate && (
          <span className="badge b-esc">Consider a legal professional</span>
        )}
        <span className="page">
          {f.page != null ? `Page ${f.page}` : "Page n/a"} · {f.chunk_id}
        </span>
        {f.confidence != null && (
          <span className="page">Confidence: {String(f.confidence)}</span>
        )}
      </div>
      <div className="label">Source passage</div>
      <div className="quote">{f.quote}</div>
      <div className="label">Plain-language explanation</div>
      <div>{f.explanation}</div>
    </div>
  );
}

export default function Page() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [sourceName, setSourceName] = useState<string>("");
  const [pasted, setPasted] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  function validateFile(f: File): string | null {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      return "Unsupported file type. Please choose a PDF, or switch to Paste text.";
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
    setMsgs([]);
    try {
      const body = new FormData();
      if (src.kind === "file") body.append("file", src.file);
      else body.append("text", src.text);
      const res = await fetch(`${API}/analyze`, { method: "POST", body });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Backend returned ${res.status}`);
      }
      const data = (await res.json()) as Analysis;
      setAnalysis({
        summary: data.summary ?? "",
        findings: data.findings ?? [],
        risks: data.risks ?? [],
        escalation: data.escalation,
      });
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

  async function ask(q: string) {
    const text = q.trim();
    if (!text || asking) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = (await res.json()) as AskResponse;
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: data.answer,
          status: data.status,
          findings: data.findings ?? [],
          escalation: data.escalation,
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: "Could not get an answer from the local backend.",
          status: "error",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  function reset() {
    setSourceName("");
    setPasted("");
    setAnalysis(null);
    setMsgs([]);
    setQuestion("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <header className="top">
        <div className="logo" aria-hidden="true">
          §
        </div>
        <h2>Private Legal Document Triage</h2>
      </header>

      <div className="banner" role="note">
        <strong>Preliminary understanding only, not legal advice.</strong> This
        tool cannot decide whether a document is valid or enforceable. Your
        document is sent only to the backend running on this device. For
        decisions that matter, consult a qualified legal professional.
      </div>

      <main className="wrap">
        {!analysis && (
          <section className="hero">
            <h1>Understand your legal document</h1>
            <p>
              Upload a PDF or paste the text of a rental agreement, employment
              contract, legal notice or service agreement. Get plain-language
              explanations of key clauses, with every point linked to the exact
              passage.
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
                Upload PDF
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
                  This can take a while on CPU-only machines.
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
                <span className="btn">Select PDF</span>
                <div className="hint">or drop a PDF file here</div>
                <div className="hint">Max {MAX_MB} MB · processed locally</div>
                <input
                  ref={inputRef}
                  className="sr"
                  type="file"
                  accept=".pdf,application/pdf"
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
                <section className="card">
                  <h3>Summary</h3>
                  <div className="summary">{analysis.summary}</div>
                  {analysis.escalation && (
                    <div className="escalate">{analysis.escalation}</div>
                  )}
                </section>

                <section className="card">
                  <h3>Risks, ambiguities and concerns</h3>
                  {analysis.risks.length === 0 ? (
                    <div className="empty">
                      No risks were flagged. This does not mean the document is
                      risk-free.
                    </div>
                  ) : (
                    analysis.risks.map((f, i) => (
                      <FindingCard key={`r-${f.chunk_id}-${i}`} f={f} />
                    ))
                  )}
                </section>

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

              <aside className="card qa">
                <h3>Ask about this document</h3>

                <div className="chips">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="chip"
                      onClick={() => ask(s)}
                      disabled={asking}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="msgs" aria-live="polite">
                  {msgs.length === 0 && (
                    <div className="empty">
                      Answers come only from the document. If it is silent on a
                      question, the tool will say so.
                    </div>
                  )}
                  {msgs.map((m, i) => (
                    <div key={i} className={`msg ${m.role}`}>
                      {m.role === "assistant" && m.status && (
                        <div className="tag">{STATUS_LABEL[m.status]}</div>
                      )}
                      <div>{m.text}</div>
                      {m.escalation && (
                        <div className="escalate">{m.escalation}</div>
                      )}
                      {m.findings?.map((f, j) => (
                        <FindingCard key={`${i}-${j}`} f={f} />
                      ))}
                    </div>
                  ))}
                  {asking && <div className="hint">Thinking on this device…</div>}
                </div>

                <form className="ask" onSubmit={onSubmit}>
                  <label className="sr" htmlFor="q">
                    Your question
                  </label>
                  <input
                    id="q"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about the document"
                    disabled={asking}
                  />
                  <button
                    className="btn small"
                    type="submit"
                    disabled={asking || !question.trim()}
                  >
                    Ask
                  </button>
                </form>
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}