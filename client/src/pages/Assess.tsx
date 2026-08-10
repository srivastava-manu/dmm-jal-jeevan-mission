import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

// Placeholder landing surface for state_assessor. The real assessment tool (layer nav,
// scoring, autosave, evidence) is built in later steps.
export function Assess() {
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
        <span className="eyebrow">State assessor</span>
        <h1>Assessment tool</h1>
        <p className="intro">
          Signed in as <strong>{user?.name}</strong>
          {user?.designation ? `, ${user.designation}` : ""}. Scoped to your own state only.
        </p>
        <p className="muted">
          This is the step-1 landing surface. The assessment screens come next.
        </p>
        <button className="ghost" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
