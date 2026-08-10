import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { fmtDate, type AssessmentSummary } from "../model";

// Screen 3. Two option cards that each START the assessment directly (no Begin button).
export function StartAssessment() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.assessments.list().then((r) => setAssessments(r.assessments)).catch(() => setAssessments([]));
  }, []);

  const lastSubmitted = assessments
    ?.filter((a) => a.status === "submitted")
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))[0];
  const hasDraft = assessments?.some((a) => a.status === "draft") ?? false;

  async function start(mode: "blank" | "prefill") {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.assessments.start(mode);
      navigate(`/assessment/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the assessment.");
      setBusy(false);
    }
  }

  return (
    <div className="centered">
      <div className="start-wrap">
        <button className="link-back" onClick={() => navigate("/home")}>← Back</button>
        <h1>Start an assessment</h1>

        {hasDraft && (
          <div className="warn-box">
            You have an assessment in progress. Starting a new one will replace that draft.
          </div>
        )}

        <div className="start-cards">
          {lastSubmitted && (
            <button
              className="start-card recommended"
              disabled={busy}
              onClick={() => start("prefill")}
            >
              <span className="tag">Recommended</span>
              <h2>Start from {fmtDate(lastSubmitted.submitted_at)}</h2>
              <p className="muted">All answers pre-filled. Change only what has moved.</p>
              <span className="cta">Begin from {fmtDate(lastSubmitted.submitted_at)} →</span>
            </button>
          )}

          <button className="start-card" disabled={busy} onClick={() => start("blank")}>
            <span className="tag muted-tag">Slower</span>
            <h2>Start blank</h2>
            <p className="muted">Answer all capabilities from scratch, layer by layer.</p>
            <span className="cta">Begin blank assessment →</span>
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        <p className="footnote">A new assessment is a dated snapshot — your saved assessments are not changed.</p>
      </div>
    </div>
  );
}
