
type Props = {
  summary: string;
  escalation?: string;
};

export default function SummaryCard({ summary, escalation }: Props) {
  return (
    <section className="card">
      <h3>Summary</h3>
      <div className="summary">{summary}</div>
      {escalation && <div className="escalate">{escalation}</div>}
    </section>
  );
}