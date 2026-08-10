import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  colorForMean,
  SCORE_COLORS,
  SCALE_LABELS,
  type NationalDashboard,
  type CapabilityMean,
} from "../model";

export function Dashboard() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<NationalDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.centreDashboard().then(setData).catch((e) => setError(String(e.message ?? e)));
  }, []);

  async function signOut() {
    await api.logout();
    setUser(null);
    navigate("/signin", { replace: true });
  }

  // Group the 48 cells into 8 layers of 6 (already ordered by the API).
  const rows = useMemo(() => {
    if (!data) return [];
    const byLayer = new Map<number, CapabilityMean[]>();
    for (const cell of data.grid) {
      const arr = byLayer.get(cell.layer_index) ?? [];
      arr.push(cell);
      byLayer.set(cell.layer_index, arr);
    }
    return [...byLayer.entries()].sort(([a], [b]) => a - b);
  }, [data]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-title">
          Digital Maturity <span className="sep">·</span> Centre{" "}
          <span className="muted">/ National Jal Jeevan Mission</span>
        </div>
        <div className="topbar-right">
          {data && (
            <span className="pill">
              {data.submittedStates} of {data.assessorStates} submitted
            </span>
          )}
          <button className="ghost small" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="dash">
        {error && <p className="error">{error}</p>}
        {!data && !error && <p className="muted">Loading national picture…</p>}

        {data && (
          <>
            <p className="meta">
              Averaged across {data.submittedStates} submitted assessments ·{" "}
              {data.assessorStates} states and UTs have an assessor. Drafts are not visible
              to the Centre and are excluded from all averages. Model {data.modelVersion}.
            </p>

            <section className="kpis">
              <Kpi label="National maturity" big={data.overall.band} accent>
                {data.overall.score} of {data.overall.outOf} · {data.overall.pct}%
              </Kpi>
              <Kpi label="Submitted" big={String(data.submittedStates)}>
                of {data.assessorStates} states with an assessor
              </Kpi>
              <Kpi label="Weakest layer" big={data.weakestLayer?.layerName ?? "—"}>
                {data.weakestLayer ? `${data.weakestLayer.score} of 24` : ""}
              </Kpi>
              <Kpi label="Strongest layer" big={data.strongestLayer?.layerName ?? "—"}>
                {data.strongestLayer ? `${data.strongestLayer.score} of 24` : ""}
              </Kpi>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>National maturity grid</h2>
                <p className="muted">
                  Each cell is the mean score across submitted states, coloured by the
                  rounded mean.
                </p>
              </div>

              <div className="legend">
                {SCORE_COLORS.map((c, i) => (
                  <span className="legend-item" key={i}>
                    <span className="swatch" style={{ background: c.bg }}>{i}</span>
                    {SCALE_LABELS[i]}
                  </span>
                ))}
                <span className="legend-caption">red → green = higher maturity</span>
              </div>

              <div className="grid-scroll">
                <div className="grid">
                  {rows.map(([layerIndex, cells]) => (
                    <div className="grid-row" key={layerIndex}>
                      <div className="grid-rowlabel">
                        <span className="mono">{layerIndex + 1}</span>{" "}
                        {cells[0]!.layer_name}
                      </div>
                      {cells.map((cell) => {
                        const col = colorForMean(cell.mean);
                        return (
                          <div
                            className="cell"
                            key={cell.capability_id}
                            style={{ background: col.bg, color: col.fg }}
                            title={`${cell.name} — mean ${cell.mean ?? "—"} across ${cell.contributing} states`}
                          >
                            <span className="cell-name">{cell.name}</span>
                            <span className="cell-score mono">
                              {cell.mean === null ? "—" : cell.mean.toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Layer-wise national average</h2>
                <p className="muted">Sum of a layer's six capability means, out of 24.</p>
              </div>
              <div className="layers">
                {data.layers.map((l) => (
                  <div className="layer-row" key={l.layerIndex}>
                    <div className="layer-name">
                      <span className="mono">{l.layerIndex + 1}</span> {l.layerName}
                    </div>
                    <div className="bar">
                      <div
                        className="bar-fill"
                        style={{ width: `${(l.score / 24) * 100}%` }}
                      />
                    </div>
                    <div className="layer-score mono">{l.score.toFixed(1)}</div>
                    <div className="layer-band">{l.band}</div>
                  </div>
                ))}
              </div>
            </section>

            <p className="footnote">
              Signed in as {user?.name}. Cell drill-down (state distribution), the state
              assessors screen and support requests are built in later steps.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  big,
  accent,
  children,
}: {
  label: string;
  big: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="kpi">
      <span className="eyebrow">{label}</span>
      <span className={accent ? "kpi-big accent" : "kpi-big"}>{big}</span>
      <span className="muted">{children}</span>
    </div>
  );
}
