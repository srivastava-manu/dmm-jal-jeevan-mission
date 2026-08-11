import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

// Centre top bar: title, the three tabs, and the "N of M submitted" pill (M from the states
// table, computed server-side).
export function CentreNav({ active }: { active: "dashboard" | "assessors" | "requests" }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [pill, setPill] = useState<{ submitted: number; total: number } | null>(null);

  useEffect(() => {
    api.centre
      .dashboard()
      .then((d) => setPill({ submitted: d.submittedStates, total: d.totalStates }))
      .catch(() => {});
  }, []);

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
        {tab("requests", "Requests", "/centre/requests")}
        {pill && <span className="pill">{pill.submitted} of {pill.total} submitted</span>}
        <button className="ghost small" onClick={signOut}>Sign out</button>
      </nav>
    </header>
  );
}
