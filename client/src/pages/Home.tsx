import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  MAX_SCORE,
  bandFor,
  fmtDate,
  colorForMean,
  type AssessmentSummary,
} from "../model";
import { SystemsDialog } from "../components/SystemsDialog";

function pctOf(a: AssessmentSummary): number {
  const max = a.total * MAX_SCORE; // derived, no hardcoded 192
  return max === 0 ? 0 : Math.round((a.score_so_far / max) * 100);
}

export function Home() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [stateName, setStateName] = useState<string>("");
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  async function load() {
    const { assessments } = await api.assessments.list();
    setAssessments(assessments);
  }

  useEffect(() => {
    void load();
    // Resolve the state's display name from the public states list.
    fetch("/api/states")
      .then((r) => r.json())
      .then((d: { states: { id: string; name: string }[] }) => {
        setStateName(d.states.find((s) => s.id === user?.stateId)?.name ?? "");
      })
      .catch(() => {});
  }, [user?.stateId]);

  const draft = useMemo(
    () => assessments?.find((a) => a.status === "draft") ?? null,
    [assessments],
  );
  const submitted = useMemo(
    () => assessments?.filter((a) => a.status === "submitted") ?? [],
    [assessments],
  );

  async function signOut() {
    await api.logout();
    setUser(null);
    navigate("/signin", { replace: true });
  }

  async function discardDraft(id: string) {
    if (armedDelete !== id) {
      setArmedDelete(id);
      setTimeout(() => setArmedDelete((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    await api.assessments.remove(id);
    setArmedDelete(null);
    void load();
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-title">
          Digital maturity <span className="muted">/ self-assessment</span>
        </div>
        <div className="topbar-right">
          <button className="ghost small" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="home">
        <div className="home-head">
          <div>
            <h1>{stateName || "Your state"}</h1>
            <p className="muted">
              {submitted.length} saved assessment{submitted.length === 1 ? "" : "s"} · Assessor:{" "}
              {user?.name}
              {user?.designation ? `, ${user.designation}` : ""}
            </p>
          </div>
          <button onClick={() => navigate("/home/start")} className="primary-btn">
            {submitted.length > 0 || draft ? "Start another" : "Start assessment"}
          </button>
        </div>

        {draft && (
          <div className="card draft-card">
            <span className="eyebrow accent">In progress</span>
            <h2>Assessment started {fmtDate(draft.created_at)}</h2>
            <div className="progress-line">
              <div className="bar wide">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.round((draft.answered / draft.total) * 100)}%` }}
                />
              </div>
              <span className="muted">
                {draft.answered} of {draft.total} answered · {draft.score_so_far}/
                {draft.total * MAX_SCORE} so far
              </span>
            </div>
            <div className="draft-actions">
              <button
                className="primary-btn"
                onClick={() => navigate(`/assessment/${draft.id}`)}
              >
                Continue assessment
              </button>
              <button className="ghost small danger" onClick={() => discardDraft(draft.id)}>
                {armedDelete === draft.id ? "Click again to discard" : "Discard draft"}
              </button>
            </div>
          </div>
        )}

        <div className="home-grid">
          <div>
            <h3 className="section-label">Saved assessments</h3>
            {assessments === null && <p className="muted">Loading…</p>}
            {assessments !== null && submitted.length === 0 && (
              <p className="muted">No submitted assessments yet.</p>
            )}
            <div className="saved-list">
              {submitted.map((a) => {
                const pct = pctOf(a);
                const col = colorForMean(pct / 25); // map 0..100% onto the 0..4 ramp
                return (
                  <div className="saved-row" key={a.id}>
                    <span
                      className="pct-square mono"
                      style={{ background: col.bg, color: col.fg }}
                    >
                      {pct}
                    </span>
                    <div className="saved-meta">
                      <span className="saved-date">{fmtDate(a.submitted_at)}</span>
                      <span className="muted">
                        {bandFor(pct)} · {a.score_so_far}/{a.total * MAX_SCORE} ·{" "}
                        {a.assessor_name ?? user?.name}
                      </span>
                    </div>
                    <span className="muted small">Results in a later step</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="section-label">Overall maturity over time</h3>
            <div className="card mini-chart">
              {submitted.length === 0 && draft === null && (
                <p className="muted">Your first assessment will appear here.</p>
              )}
              <div className="chart-bars">
                {[...submitted].reverse().map((a) => {
                  const pct = pctOf(a);
                  return (
                    <div className="chart-col" key={a.id}>
                      <span className="chart-pct mono">{pct}</span>
                      <div className="chart-bar" style={{ height: `${pct}%` }} />
                      <span className="chart-date">{fmtDate(a.submitted_at).slice(0, 6)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <h3 className="section-label" style={{ marginTop: 20 }}>Your systems</h3>
            <div className="card">
              <p className="muted" style={{ marginTop: 0 }}>
                Systems your state runs, reused as evidence on high scores.
              </p>
              <button className="ghost small" onClick={() => setSystemsOpen(true)}>
                Manage systems
              </button>
            </div>
          </div>
        </div>
      </main>

      <SystemsDialog open={systemsOpen} onClose={() => setSystemsOpen(false)} />
    </div>
  );
}
