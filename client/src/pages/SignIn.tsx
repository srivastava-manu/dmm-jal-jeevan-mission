import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth, homePathFor } from "../auth";

// Step 1 sign-in: email + password against a real account, then redirect by role.
// (The fully-designed assessor sign-in screen from the prototype — state / name /
// designation — belongs to the assessment flow in a later build step.)
export function SignIn() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await api.login(email.trim(), password);
      setUser(user);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered">
      <div className="card signin">
        <div className="mark" aria-hidden />
        <h1>Digital maturity <span className="muted">/ self-assessment</span></h1>
        <p className="intro">
          Sign in to assess your state's digital maturity, or — for the National Jal Jeevan
          Mission — to see the consolidated national picture.
        </p>
        <form onSubmit={onSubmit} noValidate>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@department.gov.in"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Required"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Continue"}
          </button>
        </form>
        <p className="footnote">
          This assessment is for your state's own roadmap. It is not used for ranking or
          fund allocation.
        </p>
      </div>
    </div>
  );
}
