import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { fmtDate, type ResultsResponse } from "../model";
import { MaturityGrid } from "../components/MaturityGrid";
import { CentreNav } from "../components/CentreNav";

// Screen 15 — read-only state detail, reached from a chip in the dashboard rail. If the id
// is a draft (or another state the Centre may not see), the results endpoint returns 404 at
// the database layer.
export function StateDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.assessments.results(id).then(setData).catch((e) => setError(String(e.message ?? e)));
  }, [id]);

  return (
    <div className="page">
      <CentreNav active="dashboard" />
      <main className="state-detail">
        <button className="link-back" onClick={() => navigate("/dashboard")}>← Back to dashboard</button>
        {error && <p className="error">{error}</p>}
        {!data && !error && <p className="muted">Loading…</p>}
        {data && (
          <>
            <div className="sd-head">
              <div>
                <h1>{data.assessment.state_name}</h1>
                <p className="muted">
                  Submitted {fmtDate(data.assessment.submitted_at)} · {data.assessment.assessor_name}
                  {data.assessment.assessor_designation ? `, ${data.assessment.assessor_designation}` : ""}
                </p>
              </div>
              <div className="sd-total">
                <span className="band-big accent">{data.summary.overallBand}</span>
                <span className="muted">{data.summary.overallScore} of {data.summary.overallMax}</span>
              </div>
            </div>
            <div className="grid-scroll">
              <MaturityGrid capabilities={data.capabilities} variant="labelled" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
