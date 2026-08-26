import type { RecentSplit } from "../hooks/useRecentSplits";

interface Props {
  recent: RecentSplit[];
  onClear: () => void;
}

/** Local-only list of recent calculations, newest first. */
export function RecentSplitsCard({ recent, onClear }: Props) {
  if (recent.length === 0) return null;

  return (
    <section className="panel" aria-labelledby="recent-title">
      <h2 className="panel-heading" id="recent-title">
        Recent calculations
      </h2>
      <ul className="recent-list">
        {recent.map((entry) => (
          <li key={entry.id} className="recent-row">
            <span className="mono small">{new Date(entry.recordedAt).toLocaleString("en-US")}</span>
            <span>
              {entry.totalXlm} XLM ÷ {entry.participants} ={" "}
              <strong>{entry.shareXlm} XLM each</strong>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-quiet-ts" onClick={onClear}>
        Clear history
      </button>
      <p className="summary-note">Stored only in this browser; never uploaded.</p>
    </section>
  );
}
