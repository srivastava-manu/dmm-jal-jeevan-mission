import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import {
  SCALE,
  SCORE_COLORS,
  colorForMean,
  fmtDate,
  type ResultsResponse,
  type HistoryResponse,
} from "../model";
import { MaturityGrid } from "../components/MaturityGrid";
import { AssessorNav } from "../components/AssessorNav";

// Screen 8 — the assessor's own dashboard: the labelled 8×6 grid plus a detail rail for the
// selected capability (measure, evidence, and how it has moved across submitted rounds).
export function AssessorDashboard() {
  const { id = "" } = useParams();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.assessments.results(id).then(setData).catch((e) => setError(String(e.message ?? e)));
    api.assessments.history(id).then(setHistory).catch(() => {});
  }, [id]);

  const selected = useMemo(
    () => data?.capabilities.find((c) => c.capability_id === selectedId) ?? null,
    [data, selectedId],
  );

  if (error) return <div className="centered"><p className="error">{error}</p></div>;
  if (!data) return <div className="centered"><p className="muted">Loading dashboard…</p></div>;

  const total = data.summary.total;
  const layerCount = data.summary.layers.length;
  const series = selected ? history?.byCapabilityName[selected.name] ?? [] : [];

  return (
    <div className="page">
      <AssessorNav label="dashboard" />

      <main className="dash-screen">
        <div className="dash-main">
            <div className="dash-head">
              <div className="dash-meta no-print">
                <h1>{total} capabilities across {layerCount} layers</h1>
                <p className="muted">{data.assessment.state_name} · {fmtDate(data.assessment.submitted_at ?? data.assessment.created_at)}</p>
              </div>
              <div className="dash-actions no-print">
                <button className="primary-btn" onClick={() => window.print()}>Export PDF</button>
              </div>
            </div>
            {/* meta line printed on the dashboard */}
          <p className="print-only dash-print-meta">
            {data.assessment.state_name} · {fmtDate(data.assessment.submitted_at ?? data.assessment.created_at)} · {total} capabilities
          </p>

          <div className="legend dash-legend">
            {SCALE.map((lvl) => (
              <span className="legend-item" key={lvl.n}>
                <span className="swatch" style={{ background: SCORE_COLORS[lvl.n]!.bg, color: SCORE_COLORS[lvl.n]!.fg }}>{lvl.n}</span>
                {lvl.short}
              </span>
            ))}
          </div>

          <div className="grid-scroll">
            <MaturityGrid
              capabilities={data.capabilities}
              variant="interactive"
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <aside className="dash-rail no-print">
          {!selected && (
            <p className="muted">
              Select any cell to see the capability, what it measures, your score, the evidence
              attached and how it has moved across rounds.
            </p>
          )}
          {selected && (
            <>
              <span className="section-label">
                Layer {selected.layer_index + 1} · {selected.layer_name}
              </span>
              <h2 className="rail-title">{selected.name}</h2>
              <div className="rail-score">
                <span className="swatch" style={{ background: colorForMean(selected.value).bg, color: colorForMean(selected.value).fg }}>
                  {selected.value ?? "—"}
                </span>
                <span>{selected.value !== null ? SCALE[selected.value]!.short : "Not scored"}</span>
              </div>
              <p className="measure">{selected.measure}</p>

              <div className="evidence-box">
                <span className="section-label">Evidence</span>
                {selected.evidence && selected.evidence.system_id ? (
                  <p>
                    {selected.evidence.system_name ?? "System attached"}
                    {selected.evidence.districts_live !== null ? ` · ${selected.evidence.districts_live} districts` : ""}
                    {selected.evidence.go_live ? ` · live ${selected.evidence.go_live.slice(0, 7)}` : ""}
                  </p>
                ) : (
                  <p className="muted">No system attached yet.</p>
                )}
              </div>

              <div className="history-box">
                <span className="section-label">Across rounds</span>
                {series.length === 0 && <p className="muted small">No submitted rounds yet.</p>}
                {series.map((h) => (
                  <div className="hist-row" key={h.assessment_id}>
                    <span className="swatch small" style={{ background: colorForMean(h.value).bg, color: colorForMean(h.value).fg }}>{h.value}</span>
                    <span className="muted small">{fmtDate(h.submitted_at)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
