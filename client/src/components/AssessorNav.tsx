import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

// Shared top navigation for the state-assessor screens: Results, History, About (in that
// order), then Sign out. "History" is the home/history screen; "Results" opens the latest
// assessment's results (the same page a saved-assessment row opens).
export function AssessorNav({ label = "self-assessment" }: { label?: string }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  async function openLatestResults() {
    try {
      const { assessments } = await api.assessments.list();
      const latestSubmitted = assessments
        .filter((a) => a.status === "submitted")
        .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))[0];
      // Prefer the latest submitted round; fall back to the most recent assessment overall
      // (the list is already ordered draft-first, then newest).
      const target = latestSubmitted ?? assessments[0];
      navigate(target ? `/assessment/${target.id}/results` : "/home");
    } catch {
      navigate("/home");
    }
  }

  async function signOut() {
    await api.logout();
    setUser(null);
    navigate("/signin", { replace: true });
  }

  return (
    <header className="topbar no-print">
      <div className="topbar-title">
        Digital maturity <span className="muted">/ {label}</span>
      </div>
      <nav className="topbar-nav">
        <button className="navlink" onClick={openLatestResults}>Results</button>
        <button className="navlink" onClick={() => navigate("/home")}>History</button>
        <button className="navlink" onClick={() => navigate("/about")}>About</button>
        <button className="ghost small" onClick={signOut}>Sign out</button>
      </nav>
    </header>
  );
}
