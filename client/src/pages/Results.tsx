import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { fmtDate, colorForMean, type ResultsResponse } from "../model";
import { MaturityGrid } from "../components/MaturityGrid";
import { AssessorNav } from "../components/AssessorNav";

// Screen 7 — Executive summary. Every number here comes from the server's scoring module;
// this component only renders. Prints as two A4 pages: the summary, then the labelled grid.
export function Results() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.assessments.results(id).then(setData).catch((e) => setError(String(e.message ?? e)));
  }, [id]);

  useEffect(() => {
    if (!data || searchParams.get("print") !== "1") return;
    const timer = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(timer);
  }, [data, searchParams]);

  if (error) return <div className="centered"><p className="error">{error}</p></div>;
  if (!data) return <div className="centered"><p className="muted">Loading results…</p></div>;

  const { assessment: a, summary: s, since, capabilities } = data;
  const dateStr = fmtDate(a.submitted_at ?? a.created_at);

  return (
    <div className="page">
      <AssessorNav label="results" />

      <main className="results">
        <div className="results-main">
          <header className="results-head">
            <h1>{a.state_name}</h1>
            <p className="muted">
              {dateStr} · assessed by {a.assessor_name ?? "—"}
              {a.assessor_designation ? `, ${a.assessor_designation}` : ""}
            </p>
          </header>

          <section className="result-cards">
            <div className="card result-card overall-card">
              <span className="eyebrow">Overall digital maturity</span>
              <div className="rc-body">
                <span className="band-big accent">{s.overallBand}</span>
                <span className="muted">{s.overallScore} of {s.overallMax} · {s.overallPct}%</span>
                <div className="bar"><div className="bar-fill" style={{ width: `${s.overallPct}%` }} /></div>
              </div>
            </div>

            {since && (
              <div className="card result-card">
                <span className="eyebrow">Since {fmtDate(since.previousDate)}</span>
                <div className="rc-body">
                  <span className="band-transition">{since.fromBand} → {since.toBand}</span>
                  <span className="muted">
                    {since.deltaPoints >= 0 ? "+" : ""}{since.deltaPoints} points · {since.improved} improved, {since.slipped} slipped
                  </span>
                  <button className="ghost small" onClick={() => navigate(`/assessment/${id}/compare`)}>
                    See what changed
                  </button>
                </div>
              </div>
            )}

            <div className="card result-card">
              <span className="eyebrow">Layers</span>
              <div className="rc-body">
                <div><span className="muted">Strongest</span><br /><strong>{s.strongestLayer.layer_name}</strong></div>
                <div><span className="muted">Most room to grow</span><br /><strong>{s.weakestLayer.layer_name}</strong></div>
              </div>
            </div>
          </section>

          <section className="layer-index">
            <h2 className="section-h">Layer-wise maturity index</h2>
            {s.layers.map((l) => (
              <div className="li-row" key={l.layer_index}>
                <div className="li-name">{l.layer_name}</div>
                <div className="bar"><div className="bar-fill" style={{ width: `${l.pct}%` }} /></div>
                <div className="li-score mono">{l.score}</div>
                <div className="li-band accent">{l.band}</div>
              </div>
            ))}
          </section>

          <section className="strength-focus">
            <div className="card sf-card strengths-card">
              <span className="eyebrow accent">Strengths</span>
              {s.strengths.map((c) => (
                <div className="sf-row" key={c.capability_id}>
                  <span className="swatch small" style={{ background: colorForMean(c.value).bg, color: colorForMean(c.value).fg }}>{c.value}</span>
                  <span>{c.name}</span>
                  <span className="muted small">{c.layer_name}</span>
                </div>
              ))}
              <p className="muted small">Strongest layer: {s.strongestLayer.layer_name}.</p>
            </div>

            <div className="card sf-card">
              <span className="eyebrow">Where to focus next</span>
              {s.focus.map((c) => (
                <div className="sf-row" key={c.capability_id}>
                  <span className="swatch small" style={{ background: colorForMean(c.value).bg, color: colorForMean(c.value).fg }}>{c.value}</span>
                  <span>{c.name}</span>
                  <span className="muted small">{c.layer_name}</span>
                </div>
              ))}
              <p className="muted small">A starting point for the roadmap, prepared offline by your team.</p>
            </div>
          </section>

          {/* Print-only page 2: the full labelled maturity grid. */}
          <section className="print-grid print-only">
            <h2 className="section-h">Maturity grid — {a.state_name}, {dateStr}</h2>
            <MaturityGrid capabilities={capabilities} variant="labelled" />
          </section>
        </div>

        <aside className="results-sidebar no-print">
          <span className="section-label">All {s.total} capabilities</span>
          <MaturityGrid capabilities={capabilities} variant="mini" />
          <button className="ghost small full" onClick={() => navigate(`/assessment/${id}/dashboard`)}>
            Open full dashboard
          </button>
          <button className="primary-btn full" onClick={() => window.print()}>Export PDF</button>
          <p className="muted small">Two A4 pages: executive summary, then the full labelled maturity grid.</p>
        </aside>
      </main>
    </div>
  );
}
