import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

// Placeholder landing surface for the Centre (NJJM). The national dashboard, user
// management and requests screens are built in later steps.
export function Dashboard() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await api.logout();
    setUser(null);
    navigate("/signin", { replace: true });
  }

  return (
    <div className="centered">
      <div className="card landing">
        <span className="eyebrow">Centre · National Jal Jeevan Mission</span>
        <h1>National dashboard</h1>
        <p className="intro">
          Signed in as <strong>{user?.name}</strong>
          {user?.designation ? `, ${user.designation}` : ""}. Sees the consolidated
          national picture across submitted assessments only.
        </p>
        <p className="muted">
          This is the step-1 landing surface. The dashboard, user management and requests
          screens come next.
        </p>
        <button className="ghost" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
