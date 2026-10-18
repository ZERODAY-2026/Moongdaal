import type { AnalysisResult, AskResponse, AskStatus, Risk } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type Source = { kind: "file"; file: File } | { kind: "text"; text: string };

type RawItem = {
  type?: string;
  label?: string;
  explanation?: string;
  chunk_id: string;
  quote: string;
};
type RawAnalyze = {
  summary?: string;
  items?: RawItem[];
  dropped_unverified?: number;
  truncated?: boolean;
};
type RawEvidence = { chunk_id: string; quote: string; label?: string };
type RawAsk = { status?: string; answer?: string; evidence?: RawEvidence[] };

function pageOf(chunkId: string): number | null {
  const m = /^P(\d+)-/.exec(chunkId);
  return m ? Number(m[1]) : null;
}

function toRisk(i: {
  chunk_id: string;
  quote: string;
  label?: string;
  explanation?: string;
}): Risk {
  return {
    quote: i.quote,
    chunk_id: i.chunk_id,
    page: pageOf(i.chunk_id),
    explanation: i.explanation ?? "",
    kind: i.label === "concern" ? "concern" : "explicit",
  };
}

async function errorText(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw);
    if (typeof j?.detail === "string") return j.detail;
  } catch {
    /* not JSON */
  }
  return raw || `Backend returned ${res.status}`;
}

/** POST /analyze (multipart form: `file`) */
export async function analyzeDocument(src: Source): Promise<AnalysisResult> {
  const body = new FormData();
  if (src.kind === "file") body.append("file", src.file);
  else body.append("file", new File([src.text], "pasted.txt", { type: "text/plain" }));

  const res = await fetch(`${API}/analyze`, { method: "POST", body });
  if (!res.ok) throw new Error(await errorText(res));

  const data = (await res.json()) as RawAnalyze;
  const items = data.items ?? [];
  return {
    summary: data.summary ?? "",
    findings: items.filter((i) => i.label !== "concern").map(toRisk),
    risks: items.filter((i) => i.label === "concern").map(toRisk),
    dropped_unverified: data.dropped_unverified ?? 0,
    truncated: data.truncated ?? false,
  };
}

const STATUSES: AskStatus[] = ["answered", "silent", "refused", "error"];

/** POST /ask (JSON: { question }) */
export async function askQuestion(question: string): Promise<AskResponse> {
  const res = await fetch(`${API}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(await errorText(res));

  const data = (await res.json()) as RawAsk;
  const status = STATUSES.includes(data.status as AskStatus)
    ? (data.status as AskStatus)
    : "error";
  return {
    status,
    answer: data.answer ?? "",
    findings: (data.evidence ?? []).map(toRisk),
    escalation: status === "refused" ? data.answer : undefined,
  };
}

/** DELETE /session: tells the backend to drop the document from memory */
export async function clearSession(): Promise<void> {
  await fetch(`${API}/session`, { method: "DELETE" });
}