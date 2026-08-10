import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import type { ReviewResult } from "../model";

// Screen 6. The submit button's enabled state and the unanswered list come from the SAME
// server response, so they can never disagree — no client-side recomputation of "answered".
export function Review() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setReview(await api.assessments.review(id));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.assessments.submit(id);
      navigate("/home", { replace: true });
    } catch (e) {
      setError(String((e as Error).message ?? e));
      await load(); // resync with the server's authoritative counts
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !review) return <div className="centered"><p className="error">{error}</p></div>;
  if (!review) return <div className="centered"><p className="muted">Loading…</p></div>;

  const pct = review.total === 0 ? 0 : Math.round((review.answered / review.total) * 100);

  return (
    <div className="centered">
      <div className="review-wrap">
        <button className="link-back" onClick={() => navigate(`/assessment/${id}`)}>← Back to assessment</button>
        <h1>Review &amp; submit</h1>

        <div className="progress-line">
          <div className="bar wide"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
          <span className="muted mono">{review.answered} of {review.total}</span>
        </div>

        {review.unanswered.length > 0 && (
          <div className="block danger-block">
            <h2>{review.unanswered.length} still unanswered</h2>
            <div className="block-list">
              {review.unanswered.map((u) => (
                <button
                  key={u.capability_id}
                  className="block-row"
                  onClick={() => navigate(`/assessment/${id}?layer=${u.layer_index}`)}
                >
                  <span>{u.name}</span>
                  <span className="muted">{u.layer_name} →</span>
                </button>
              ))}
            </div>
            <p className="block-note">
              A partial assessment distorts the index — answer these before submitting.
            </p>
          </div>
        )}

        {review.evidenceGaps.count > 0 && (
          <div className="block warning-block">
            <h2>{review.evidenceGaps.count} high scores without a system named</h2>
            <p className="block-note">
              Naming the system behind a 3 or 4 is encouraged, not required — you can still submit.
            </p>
          </div>
        )}

        {review.consistencyFlags.length > 0 && (
          <div className="block review-block">
            <h2>Worth a second look</h2>
            <ul className="flag-list">
              {review.consistencyFlags.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <p className="block-note">These are not blocking — review them if they look wrong.</p>
          </div>
        )}

        {review.canSubmit && (
          <div className="submit-box">
            Thank you {user?.name} for completing the assessment! Once submitted, you can edit
            the scores for the next 7 days. After 7 days, the scores will be locked.
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="review-actions">
          <button className="ghost" onClick={() => navigate(`/assessment/${id}`)}>Keep editing</button>
          <button
            className="primary-btn"
            disabled={!review.canSubmit || submitting}
            onClick={submit}
          >
            {submitting ? "Submitting…" : "Submit assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}
