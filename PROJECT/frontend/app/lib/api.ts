import type { AnalysisResult, AskResponse } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Source = { kind: "file"; file: File } | { kind: "text"; text: string };

/** POST /analyze (multipart form: `file` or `text`) */
export async function analyzeDocument(src: Source): Promise<AnalysisResult> {
  const body = new FormData();
  if (src.kind === "file") body.append("file", src.file);
  else body.append("text", src.text);
  const res = await fetch(`${API}/analyze`, { method: "POST", body });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Backend returned ${res.status}`);
  }
  const data = (await res.json()) as AnalysisResult;
  return {
    summary: data.summary ?? "",
    findings: data.findings ?? [],
    risks: data.risks ?? [],
    escalation: data.escalation,
  };
}

/** POST /ask (JSON: { question }) */
export async function askQuestion(question: string): Promise<AskResponse> {
  const res = await fetch(`${API}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return (await res.json()) as AskResponse;
}