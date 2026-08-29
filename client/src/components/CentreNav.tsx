import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

// Centre top bar: title and the three tabs. Coverage/submission counts live on the dashboard
// KPI cards, where each denominator is labelled — the bar deliberately carries no figure, so
// there is no unexplained "N of M" to contradict them. (This also means the bar no longer
// runs the full national aggregation on every Centre page just to render two numbers.)
export function CentreNav({ active }: { active: "dashboard" | "assessors" | "requests" }) {
  const navigate = useNavigate();
  const { setUser, features } = useAuth();

  async function signOut() {
    await api.logout();
    setUser(null);
    navigate("/signin", { replace: true });
  }

  const tab = (key: typeof active, label: string, path: string) => (
    <button className={active === key ? "navlink on" : "navlink"} onClick={() => navigate(path)}>
      {label}
    </button>
  );

  return (
    <header className="topbar no-print">
      <div className="topbar-title">
        Digital Maturity <span className="sep">·</span> Centre{" "}
        <span className="muted">/ National Jal Jeevan Mission</span>
      </div>
      <nav className="topbar-nav">
        {tab("dashboard", "Dashboard", "/dashboard")}
        {tab("assessors", "State assessors", "/centre/assessors")}
        {features.supportRequests && tab("requests", "Requests", "/centre/requests")}
        <button className="ghost small" onClick={signOut}>Sign out</button>
      </nav>
    </header>
  );
}
