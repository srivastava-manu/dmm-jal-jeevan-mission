import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  SCALE,
  SCORE_COLORS,
  MAX_SCORE,
  bandFor,
  fmtDate,
  type AssessmentDetail,
  type Capability,
  type EvidenceRow,
  type SystemRow,
} from "../model";
import { SystemsDialog } from "../components/SystemsDialog";

interface ScoreState {
  value: number | null;
  note: string | null;
  evidence: EvidenceRow | null;
}

const ADD_SYSTEM = "__add_system__";

export function Assess() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [scores, setScores] = useState<Record<string, ScoreState>>({});
  const [systems, setSystems] = useState<SystemRow[]>([]);
  // Deep-link support: /assessment/:id?layer=N opens straight to that layer (used by the
  // Review screen's "unanswered" rows).
  const [layerIndex, setLayerIndex] = useState(() => {
    const n = Number(params.get("layer"));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ capabilityId: string; capabilityName: string } | null>(null);

  useEffect(() => {
    api.assessments
      .get(id)
      .then((d) => {
        setDetail(d);
        const map: Record<string, ScoreState> = {};
        for (const s of d.scores) {
          map[s.capability_id] = { value: s.value, note: s.note, evidence: s.evidence };
        }
        setScores(map);
      })
      .catch((e) => setError(String(e.message ?? e)));
    api.systems.list().then((r) => setSystems(r.systems)).catch(() => {});
  }, [id]);

  // Group capabilities into layers, in display order — the count of layers and of
  // capabilities per layer is whatever the model has, never assumed.
  const layers = useMemo(() => {
    const byLayer = new Map<number, Capability[]>();
    for (const c of detail?.capabilities ?? []) {
      const arr = byLayer.get(c.layer_index) ?? [];
      arr.push(c);
      byLayer.set(c.layer_index, arr);
    }
    return [...byLayer.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, caps]) => ({ index, name: caps[0]!.layer_name, caps }));
  }, [detail]);

  const total = detail?.capabilities.length ?? 0;
  const valueOf = (capId: string): number | null => scores[capId]?.value ?? null;
  const isAnswered = (capId: string) => valueOf(capId) !== null; // 0 counts; never truthiness
  const answered = (detail?.capabilities ?? []).filter((c) => isAnswered(c.id)).length;
  const overallScore = (detail?.capabilities ?? []).reduce((sum, c) => sum + (valueOf(c.id) ?? 0), 0);
  const overallMax = total * MAX_SCORE;
  const overallPct = overallMax === 0 ? 0 : Math.round((overallScore / overallMax) * 100);

  function layerStats(caps: Capability[]) {
    const ans = caps.filter((c) => isAnswered(c.id)).length;
    const score = caps.reduce((sum, c) => sum + (valueOf(c.id) ?? 0), 0);
    const max = caps.length * MAX_SCORE;
    const pct = max === 0 ? 0 : Math.round((score / max) * 100);
    return { ans, score, max, pct, complete: ans === caps.length, started: ans > 0 };
  }

  const layersWithUnanswered = layers.filter(
    (l) => l.caps.some((c) => !isAnswered(c.id)),
  ).length;

  async function setScore(cap: Capability, value: number) {
    // Toggle off if the same value is clicked again.
    const next = valueOf(cap.id) === value ? null : value;
    setScores((prev) => {
      const cur = prev[cap.id] ?? { value: null, note: null, evidence: null };
      return {
        ...prev,
        [cap.id]: { ...cur, value: next, evidence: next !== null && next >= 3 ? cur.evidence : null },
      };
    });
    try {
      await api.assessments.saveScore(id, cap.id, next);
      setSavedAt("Saved just now");
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function setEvidence(cap: Capability, patch: Partial<EvidenceRow>) {
    const cur = scores[cap.id]?.evidence ?? {
      system_id: null,
      districts_live: null,
      go_live: null,
    };
    const ev = { ...cur, ...patch };
    setScores((prev) => ({ ...prev, [cap.id]: { ...prev[cap.id]!, evidence: ev } }));
    try {
      await api.assessments.saveEvidence(id, cap.id, ev);
      setSavedAt("Saved just now");
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  if (error) return <div className="centered"><p className="error">{error}</p></div>;
  if (!detail) return <div className="centered"><p className="muted">Loading assessment…</p></div>;

  const safeLayerIndex = Math.min(Math.max(layerIndex, 0), layers.length - 1);
  const layer = layers[safeLayerIndex]!;
  const ls = layerStats(layer.caps);
  const isLastLayer = safeLayerIndex === layers.length - 1;

  return (
    <div className="assess">
      <header className="topbar">
        <div className="topbar-title">
          Digital maturity <span className="muted">/ assessment</span>
        </div>
        <div className="topbar-right">
          <span className="muted small">
            Model {detail.assessment.model_version} · {total} capabilities
          </span>
          {savedAt && <span className="saved-indicator">{savedAt}</span>}
          <button className="ghost small" onClick={() => navigate("/home")}>Home</button>
        </div>
      </header>

      <div className="assess-cols">
        {/* Left: layer nav */}
        <nav className="layer-nav">
          <div className="nav-progress">
            <span className="section-label">
              Layers <span className="mono">{answered} of {total}</span>
            </span>
            <div className="bar"><div className="bar-fill" style={{ width: `${Math.round((answered / total) * 100)}%` }} /></div>
          </div>
          {layers.map((l) => {
            const st = layerStats(l.caps);
            const active = l.index === safeLayerIndex;
            return (
              <button
                key={l.index}
                className={`nav-item${active ? " active" : ""}`}
                onClick={() => setLayerIndex(l.index)}
              >
                <span className="nav-item-name">
                  <span className="mono">{l.index + 1}</span> {l.name}
                </span>
                <span className="nav-item-meta">
                  <span className="mono">{st.ans}/{l.caps.length}</span>
                  <span className={`dot ${st.complete ? "done" : st.started ? "partial" : "none"}`} />
                </span>
              </button>
            );
          })}
          <p className="nav-foot muted">
            Model {detail.assessment.model_version} · {total} capabilities · scale 0–{MAX_SCORE}.
            Answers save as you go.
          </p>
        </nav>

        {/* Center: capability cards */}
        <main className="cap-list">
          <div className="cap-list-head">
            <span className="eyebrow">Layer {layer.index + 1} of {layers.length}</span>
            <h1>{layer.name}</h1>
            <p className="muted">{layer.caps[0]!.layer_covers}</p>
          </div>

          {layer.caps.map((cap) => (
            <CapabilityCard
              key={cap.id}
              cap={cap}
              state={scores[cap.id] ?? { value: null, note: null, evidence: null }}
              previousValue={detail.previous?.values[cap.id]}
              previousDate={detail.previous?.submitted_at ?? null}
              systems={systems}
              onScore={(v) => setScore(cap, v)}
              onEvidence={(patch) => setEvidence(cap, patch)}
              onAddSystem={() => setDialog({ capabilityId: cap.id, capabilityName: cap.name })}
            />
          ))}

          <div className="layer-nav-btns">
            <button
              className="ghost"
              disabled={safeLayerIndex === 0}
              onClick={() => setLayerIndex(safeLayerIndex - 1)}
            >
              ← Previous layer
            </button>
            {isLastLayer ? (
              <button
                className="primary-btn"
                onClick={() => navigate(`/assessment/${id}/review`)}
              >
                Review & submit →
              </button>
            ) : (
              <button className="primary-btn" onClick={() => setLayerIndex(safeLayerIndex + 1)}>
                Next layer →
              </button>
            )}
          </div>
        </main>

        {/* Right: score rail */}
        <aside className="score-rail">
          <RailBox label="Progress" big={String(answered)} unit={`of ${total} answered`}
            pct={Math.round((answered / total) * 100)}
            note={`${total - answered} left across ${layersWithUnanswered} layer${layersWithUnanswered === 1 ? "" : "s"}`} />
          <RailBox label="Score for this layer" big={String(ls.score)} unit={`of ${ls.max}`}
            band={bandFor(ls.pct)} pct={ls.pct}
            note={ls.complete ? "All capabilities in this layer answered." : `${ls.ans} of ${layer.caps.length} answered`} />
          <RailBox label="Overall score so far" big={String(overallScore)} unit={`of ${overallMax}`}
            band={bandFor(overallPct)} pct={overallPct}
            note={detail.previous ? `Compared with ${fmtDate(detail.previous.submitted_at)}` : "First assessment"} />

          <div className="scale-ref">
            <span className="section-label">Scale</span>
            {SCALE.map((s) => (
              <div className="scale-ref-row" key={s.n} title={s.d}>
                <span className="swatch small" style={{ background: SCORE_COLORS[s.n]!.bg, color: SCORE_COLORS[s.n]!.fg }}>{s.n}</span>
                {s.short}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <SystemsDialog
        open={dialog !== null}
        contextCapability={dialog?.capabilityName}
        onClose={() => setDialog(null)}
        onChanged={setSystems}
        onAdded={(system) => {
          setSystems((prev) => [...prev.filter((s) => s.id !== system.id), system]);
          if (dialog) {
            const cap = detail.capabilities.find((c) => c.id === dialog.capabilityId);
            if (cap) void setEvidence(cap, { system_id: system.id });
          }
        }}
      />
    </div>
  );
}

function CapabilityCard({
  cap,
  state,
  previousValue,
  previousDate,
  systems,
  onScore,
  onEvidence,
  onAddSystem,
}: {
  cap: Capability;
  state: ScoreState;
  previousValue: number | undefined;
  previousDate: string | null;
  systems: SystemRow[];
  onScore: (v: number) => void;
  onEvidence: (patch: Partial<EvidenceRow>) => void;
  onAddSystem: () => void;
}) {
  const value = state.value;
  const showEvidence = value !== null && value >= 3;
  const ev = state.evidence;

  return (
    <div className="cap-card">
      <h3>{cap.name}</h3>
      <p className="measure">{cap.measure}</p>
      {cap.includes.length > 0 && (
        <div className="pills">
          {cap.includes.map((i) => <span className="pill-sm" key={i}>{i}</span>)}
        </div>
      )}
      <p className="caption muted">Rate against the functions listed above, as they work today.</p>

      <div className="score-row">
        {SCALE.map((s) => {
          const selected = value === s.n;
          const col = SCORE_COLORS[s.n]!;
          return (
            <button
              key={s.n}
              className={`score-btn${selected ? " selected" : ""}`}
              style={selected ? { background: col.bg, borderColor: col.bg, color: col.fg } : undefined}
              title={s.d}
              onClick={() => onScore(s.n)}
            >
              <span className="mono num">{s.n}</span>
              <span className="lbl">{s.short}</span>
            </button>
          );
        })}
      </div>

      {showEvidence && (
        <div className="evidence">
          <span className="section-label">Evidence</span>
          <div className="evidence-fields">
            <select
              value={ev?.system_id ?? ""}
              onChange={(e) => {
                if (e.target.value === ADD_SYSTEM) onAddSystem();
                else onEvidence({ system_id: e.target.value || null });
              }}
            >
              <option value="">Select a system…</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={ADD_SYSTEM}>+ Add a new system…</option>
            </select>
            <input
              type="number"
              min={0}
              placeholder="Districts live"
              value={ev?.districts_live ?? ""}
              onChange={(e) =>
                onEvidence({ districts_live: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
            <input
              type="month"
              aria-label="Go-live month"
              value={ev?.go_live ? ev.go_live.slice(0, 7) : ""}
              onChange={(e) => onEvidence({ go_live: e.target.value ? `${e.target.value}-01` : null })}
            />
          </div>
        </div>
      )}

      <div className="cap-foot">
        <span>
          {value !== null ? `Scored ${value} · ${SCALE[value]!.short}` : "Not scored"}
        </span>
        {previousValue !== undefined && previousDate && (
          <span className="muted">Was {previousValue} on {fmtDate(previousDate)}</span>
        )}
      </div>
    </div>
  );
}

function RailBox({
  label,
  big,
  unit,
  band,
  pct,
  note,
}: {
  label: string;
  big: string;
  unit: string;
  band?: string;
  pct: number;
  note: string;
}) {
  return (
    <div className="rail-box">
      <span className="section-label">{label}</span>
      <div className="rail-figure">
        <span className="rail-big mono">{big}</span>
        <span className="rail-unit muted">{unit}</span>
        {band && <span className="rail-band accent">{band}</span>}
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="muted small">{note}</span>
    </div>
  );
}
