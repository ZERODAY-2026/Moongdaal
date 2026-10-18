import { KIND_LABEL } from "../lib/types";
import type { Risk } from "../lib/types";

/** One flagged passage with its plain-language explanation. Also used by QAChat. */
export function FindingCard({ f }: { f: Risk }) {
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

export default function RisksList({ risks }: { risks: Risk[] }) {
  return (
    <section className="card">
      <h3>Risks, ambiguities and concerns</h3>
      {risks.length === 0 ? (
        <div className="empty">
          No risks were flagged. This does not mean the document is risk-free.
        </div>
      ) : (
        risks.map((f, i) => <FindingCard key={`r-${f.chunk_id}-${i}`} f={f} />)
      )}
    </section>
  );
}