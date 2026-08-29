import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  colorForMean,
  SCORE_COLORS,
  SCALE,
  type CentreDashboard,
  type CentreCell,
  type LevelBucket,
} from "../model";
import { CentreNav } from "../components/CentreNav";
import { useAuth } from "../auth";

// Screen 12 — national dashboard. Every figure is a real count from the server aggregation
// over each state's latest submitted assessment; nothing is simulated.
export function Dashboard() {
  const navigate = useNavigate();
  const { features } = useAuth();
  const [data, setData] = useState<CentreDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openLevel, setOpenLevel] = useState<number | null>(null);

  useEffect(() => {
    api.centre.dashboard().then(setData).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const byLayer = new Map<number, CentreCell[]>();
    for (const c of data.grid) {
      const arr = byLayer.get(c.layer_index) ?? [];
      arr.push(c);
      byLayer.set(c.layer_index, arr);
    }
    return [...byLayer.entries()].sort(([a], [b]) => a - b);
  }, [data]);

  const selected = useMemo(
    () => data?.grid.find((c) => c.capability_id === selectedId) ?? null,
    [data, selectedId],
  );

  function selectCell(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
    setOpenLevel(null);
  }

  if (error) return <div className="page"><CentreNav active="dashboard" /><main className="centre-dash"><p className="error">{error}</p></main></div>;
  if (!data) return <div className="page"><CentreNav active="dashboard" /><main className="centre-dash"><p className="muted">Loading…</p></main></div>;

  const distribution: LevelBucket[] = selected ? selected.distribution : data.overallDistribution;

  return (
    <div className="page">
      <CentreNav active="dashboard" />
      <main className="centre-dash">
        <p className="meta">
          Averaged across {data.submittedStates} submitted assessments · {data.statesWithAssessor}{" "}
          states and UTs have an assessor. Drafts are not visible to the Centre and are excluded
          from all averages.
          {data.excludedCapabilities > 0
            ? ` ${data.excludedCapabilities} capability(ies) from other model versions are excluded.`
            : ""}
        </p>

        <div className="centre-grid-layout">
          <div className="centre-main">
            <section className="kpis">
              <Kpi label="National maturity" big={data.overall.band} accent>
                {data.overall.score} of {data.overall.outOf} · {data.overall.pct}%
              </Kpi>
              {/* The chain reads 36 total -> 26 have an assessor -> 20 submitted, so each
                  denominator is labelled and none can be mistaken for another. */}
              <Kpi label="Assessor coverage" big={String(data.statesWithAssessor)}>
                of {data.totalStates} states and UTs have an assessor
              </Kpi>
              <Kpi label="Submitted" big={String(data.submittedStates)}>
                of {data.statesWithAssessor} states with an assessor
              </Kpi>
              <Kpi label="Weakest layer" big={data.weakestLayer?.layer_name ?? "—"}>
                {data.weakestLayer ? `${data.weakestLayer.score} of ${data.weakestLayer.outOf}` : ""}
              </Kpi>
              {features.supportRequests && (
                <Kpi label="Open requests" big={String(data.openRequests)}>
                  {data.newRequests} new
                </Kpi>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>National maturity grid</h2>
                <p className="muted">
                  Each cell is the mean score across submitted states · click one to see its
                  distribution.
                </p>
              </div>

              <div className="legend">
                {SCALE.map((lvl) => (
                  <span className="legend-item" key={lvl.n}>
                    <span className="swatch" style={{ background: SCORE_COLORS[lvl.n]!.bg, color: SCORE_COLORS[lvl.n]!.fg }}>{lvl.n}</span>
                    {lvl.short}
                  </span>
                ))}
              </div>

              {data.submittedStates === 0 ? (
                <p className="muted">No assessments have been submitted yet.</p>
              ) : (
                <div className="grid-scroll">
                  <div className="grid">
                    {rows.map(([layerIndex, cells]) => (
                      <div className="grid-row" key={layerIndex} style={{ gridTemplateColumns: `150px repeat(${cells.length}, 1fr)` }}>
                        <div className="grid-rowlabel"><span className="mono">{layerIndex + 1}</span> {cells[0]!.layer_name}</div>
                        {cells.map((cell) => {
                          const col = colorForMean(cell.mean);
                          return (
                            <div
                              key={cell.capability_id}
                              className={`cell clickable${selectedId === cell.capability_id ? " selected" : ""}`}
                              style={{ background: col.bg, color: col.fg }}
                              onClick={() => selectCell(cell.capability_id)}
                              title={`${cell.name}: mean ${cell.mean ?? "—"} across ${cell.contributing} states`}
                            >
                              <span className="cell-name">{cell.name}</span>
                              <span className="cell-score mono">{cell.mean === null ? "—" : cell.mean.toFixed(1)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Layer-wise national average</h2>
                <p className="muted">Sum of its six capability means, out of 24.</p>
              </div>
              <div className="layers">
                {data.layers.map((l) => (
                  <div className="layer-row" key={l.layer_index}>
                    <div className="layer-name"><span className="mono">{l.layer_index + 1}</span> {l.layer_name}</div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${l.pct}%` }} /></div>
                    <div className="layer-score mono" title={`${l.score} of ${l.outOf}`}>{l.score.toFixed(1)}</div>
                    <div className="layer-band">{l.band}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="centre-rail">
            {selected ? (
              <>
                <span className="section-label">{selected.layer_name}</span>
                <h2 className="rail-title">{selected.name}</h2>
                <div className="rail-score">
                  <span className="swatch" style={{ background: colorForMean(selected.mean).bg, color: colorForMean(selected.mean).fg }}>
                    {selected.mean === null ? "—" : selected.mean.toFixed(1)}
                  </span>
                  <span className="muted small">National average across {selected.contributing} states</span>
                </div>
                <p className="measure">{selected.measure}</p>
              </>
            ) : (
              <>
                <span className="section-label">All capabilities</span>
                <p className="muted small">
                  Select any cell to see its distribution. Below, states are grouped by their most
                  common score.
                </p>
              </>
            )}

            <div className="distribution">
              {distribution
                .slice()
                .reverse()
                .map((b) => (
                  <div className="dist-block" key={b.level}>
                    <button className="dist-row" onClick={() => setOpenLevel((cur) => (cur === b.level ? null : b.level))}>
                      <span className="swatch small" style={{ background: SCORE_COLORS[b.level]!.bg, color: SCORE_COLORS[b.level]!.fg }}>{b.level}</span>
                      <span className="dist-label">{SCALE[b.level]!.short}</span>
                      <span className="dist-count mono">{b.count}</span>
                      <span className="caret">{openLevel === b.level ? "▾" : "▸"}</span>
                    </button>
                    {openLevel === b.level && b.states.length > 0 && (
                      <div className="chips">
                        {b.states.map((s) => (
                          <button className="state-chip" key={s.state_id} onClick={() => navigate(`/state/${s.assessment_id}`)}>
                            {s.state_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, big, accent, children }: { label: string; big: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="kpi">
      <span className="eyebrow">{label}</span>
      <span className={accent ? "kpi-big accent" : "kpi-big"}>{big}</span>
      <span className="muted">{children}</span>
    </div>
  );
}
