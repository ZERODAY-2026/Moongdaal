"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { FindingCard } from "./RisksList";
import { askQuestion } from "../lib/api";
import { STATUS_LABEL } from "../lib/types";
import type { AskResponse, QAMessage } from "../lib/types";

export const DEFAULT_SUGGESTIONS = [
  "What are the termination conditions?",
  "What penalties or fees apply?",
  "What are my obligations and deadlines?",
  "Is this enforceable?",
];

type Props = {
  /** Defaults to lib/api askQuestion. Must reject on failure. */
  onAsk?: (question: string) => Promise<AskResponse>;
  suggestions?: string[];
};

export default function QAChat({
  onAsk = askQuestion,
  suggestions = DEFAULT_SUGGESTIONS,
}: Props) {
  const [msgs, setMsgs] = useState<QAMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || asking) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setAsking(true);
    try {
      const data = await onAsk(text);
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

  return (
    <aside className="card qa">
      <h3>Ask about this document</h3>

      <div className="chips">
        {suggestions.map((s) => (
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
            Answers come only from the document. If it is silent on a question,
            the tool will say so.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "assistant" && m.status && (
              <div className="tag">{STATUS_LABEL[m.status]}</div>
            )}
            <div>{m.text}</div>
            {m.escalation && <div className="escalate">{m.escalation}</div>}
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
  );
}