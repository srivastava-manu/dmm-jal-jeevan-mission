import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { CentreNav } from "../components/CentreNav";
import { fmtDate, type CentreEvidenceRow } from "../model";

export function CentreEvidence() {
  const [evidence, setEvidence] = useState<CentreEvidenceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [layerFilter, setLayerFilter] = useState("");

  useEffect(() => {
    api.centre.evidence()
      .then((data) => setEvidence(data.evidence))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load evidence."));
  }, []);

  const systemCount = useMemo(
    () => new Set(evidence?.map((row) => row.system_id) ?? []).size,
    [evidence],
  );
  const stateCount = useMemo(
    () => new Set(evidence?.map((row) => row.state_id) ?? []).size,
    [evidence],
  );
  const states = useMemo(
    () => [...new Map(evidence?.map((row) => [row.state_id, row.state_name]) ?? [])]
      .sort((a, b) => a[1].localeCompare(b[1])),
    [evidence],
  );
  const layers = useMemo(
    () => [...new Map(evidence?.map((row) => [row.layer_index, row.layer_name]) ?? [])]
      .sort((a, b) => a[0] - b[0]),
    [evidence],
  );
  const filteredEvidence = useMemo(
    () => evidence?.filter(
      (row) =>
        (!stateFilter || row.state_id === stateFilter) &&
        (!layerFilter || String(row.layer_index) === layerFilter),
    ) ?? [],
    [evidence, stateFilter, layerFilter],
  );

  return (
    <div className="page">
      <CentreNav active="evidence" />
      <main className="centre-evidence">
        <div className="evidence-head">
          <div>
            <h1>Evidence catalogue</h1>
            <p className="muted">
              Systems cited against scores of 3 or 4 in each state’s latest submitted assessment.
            </p>
          </div>
          {evidence && (
            <div className="evidence-summary">
              <strong>{systemCount}</strong> systems · <strong>{stateCount}</strong> states / UTs
            </div>
          )}
        </div>

        {error && <p className="error">{error}</p>}
        {!error && evidence === null && <p className="muted">Loading evidence…</p>}
        {evidence?.length === 0 && (
          <div className="panel evidence-empty">
            <h2>No evidence submitted yet</h2>
            <p className="muted">
              Systems will appear here when a state submits a score of 3 or 4 with evidence attached.
            </p>
          </div>
        )}

        {evidence && evidence.length > 0 && (
          <>
            <div className="evidence-filters">
              <label>
                State or UT
                <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                  <option value="">All states and UTs</option>
                  {states.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label>
                Layer
                <select value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)}>
                  <option value="">All layers</option>
                  {layers.map(([index, name]) => (
                    <option key={index} value={index}>{index + 1} · {name}</option>
                  ))}
                </select>
              </label>
              {(stateFilter || layerFilter) && (
                <button
                  className="ghost small"
                  onClick={() => {
                    setStateFilter("");
                    setLayerFilter("");
                  }}
                >
                  Clear filters
                </button>
              )}
              <span className="muted small evidence-match-count">
                {filteredEvidence.length} {filteredEvidence.length === 1 ? "record" : "records"}
              </span>
            </div>

            {filteredEvidence.length === 0 ? (
              <div className="panel evidence-empty">
                <h2>No matching evidence</h2>
                <p className="muted">Try another state, UT, or layer.</p>
              </div>
            ) : (
              <div className="evidence-table-wrap">
                <table className="evidence-table">
              <thead>
                <tr>
                  <th>System</th>
                  <th>State / UT</th>
                  <th>Layer</th>
                  <th>Capability</th>
                  <th>Implemented since</th>
                  <th>Districts</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvidence.map((row) => (
                  <tr key={`${row.state_id}:${row.system_id}:${row.capability_id}`}>
                    <td><strong>{row.system_name}</strong></td>
                    <td>{row.state_name}</td>
                    <td><span className="mono">{row.layer_index + 1}</span> · {row.layer_name}</td>
                    <td>{row.capability_name}</td>
                    <td>{row.go_live ? fmtDate(row.go_live) : "Not provided"}</td>
                    <td>{row.districts_live ?? "Not provided"}</td>
                    <td><span className={`evidence-score score-${row.score_value}`}>{row.score_value}</span></td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}