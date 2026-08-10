import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { fmtDate, type CompareResponse } from "../model";

// Screen 9 — Compare. All figures come from the server's compare computation, which matches
// capabilities by name across model versions and excludes added/retired ones from the counts.
export function Compare() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const to = params.get("to") ?? undefined;
    api.assessments.compare(id, to).then(setData).catch((e) => setError(String(e.message ?? e)));
  }, [id, params]);

  if (error) return <div className="centered"><p className="error">{error}</p></div>;
  if (!data) return <div className="centered"><p className="muted">Loading comparison…</p></div>;

  const { compare: c, current, earlier } = data;

  return (
    <div className="page">
      <header className="topbar no-print">
        <div className="topbar-title">Digital maturity <span className="muted">/ compare</span></div>
        <div className="topbar-right">
          <button className="ghost small" onClick={() => navigate(`/assessment/${id}/results`)}>Results</button>
          <button className="ghost small" onClick={() => navigate("/home")}>Home</button>
        </div>
      </header>

      <main className="compare">
        <p className="muted">
          {fmtDate(earlier.submitted_at)} ({earlier.model_version}) → {fmtDate(current.submitted_at ?? current.created_at)} ({current.model_version})
        </p>

        <div className="transition-big">
          <span className="mono">{c.transition.from}</span>
          <span className="arrow">→</span>
          <span className="mono">{c.transition.to}</span>
          <span className="delta accent">
            {c.transition.delta >= 0 ? "+" : ""}{c.transition.delta} points
          </span>
        </div>
        <p className="muted small">{c.transition.fromBand} → {c.transition.toBand}, across {c.comparableCount} comparable capabilities.</p>

        <div className="chips">
          <span className="chip improved">▲ {c.improved} improved</span>
          <span className="chip same">= {c.same} same</span>
          <span className="chip slipped">▼ {c.slipped} slipped</span>
        </div>

        <section className="card">
          <span className="section-label">Biggest moves</span>
          {c.biggestMoves.length === 0 && <p className="muted small">No capability changed.</p>}
          {c.biggestMoves.map((m) => (
            <div className="move-row" key={m.name}>
              <span className="move-name">{m.name}</span>
              <span className="muted small">{m.layer_name}</span>
              <span className="mono">{m.from} → {m.to}</span>
              <span className={m.delta > 0 ? "delta accent" : "delta danger"}>
                {m.delta > 0 ? "▲" : "▼"} {Math.abs(m.delta)}
              </span>
            </div>
          ))}
        </section>

        {c.notComparable.length > 0 && (
          <section className="card notcomp-card">
            <span className="section-label">Not comparable ({c.notComparable.length})</span>
            <div className="notcomp-list">
              {c.notComparable.map((n) => (
                <div className="notcomp-row" key={n.name + n.status}>
                  <span>{n.name}</span>
                  <span className="muted small">{n.layer_name} · {n.status}</span>
                </div>
              ))}
            </div>
            <p className="muted small">
              Capabilities added or reworded since the earlier version are shown as new, never
              as an improvement — they are excluded from the counts above.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
