// Shared types, agreed with the backend (/analyze and /ask responses).

export type Kind = "explicit" | "interpretation" | "concern";

/** A passage from the document plus a plain-language explanation. */
export type Risk = {
  quote: string;
  chunk_id: string;
  page: number | null;
  explanation: string;
  kind: Kind;
  confidence?: number | string;
  escalate?: boolean;
};

export type AnalysisResult = {
  summary: string;
  findings: Risk[]; // key clauses
  risks: Risk[];
  escalation?: string;
  dropped_unverified?: number;
  truncated?: boolean;
};

export type AskStatus = "answered" | "silent" | "refused" | "error";

export type AskResponse = {
  status: AskStatus;
  answer: string;
  findings: Risk[];
  escalation?: string;
};

export type QAMessage = {
  role: "user" | "assistant";
  text: string;
  status?: AskStatus;
  findings?: Risk[];
  escalation?: string;
};

export const KIND_LABEL: Record<Kind, string> = {
  explicit: "Stated in document",
  interpretation: "Possible interpretation",
  concern: "Possible concern",
};

export const STATUS_LABEL: Record<AskStatus, string> = {
  answered: "Answer from the document",
  silent: "The document does not address this",
  refused: "Cannot give a verdict",
  error: "Error",
};