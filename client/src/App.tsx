import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, homePathFor } from "./auth";
import { SignIn } from "./pages/SignIn";
import { Assess } from "./pages/Assess";
import { Dashboard } from "./pages/Dashboard";
import type { Role } from "./api";

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="centered">{children}</div>;
}

/** Guards a route to authenticated users of a given role; redirects everyone else. */
function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPage>Loading…</FullPage>;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />;
  return <>{children}</>;
}

export function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/signin"
        element={
          loading ? (
            <FullPage>Loading…</FullPage>
          ) : user ? (
            <Navigate to={homePathFor(user.role)} replace />
          ) : (
            <SignIn />
          )
        }
      />
      <Route
        path="/assess"
        element={
          <RequireRole role="state_assessor">
            <Assess />
          </RequireRole>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireRole role="centre">
            <Dashboard />
          </RequireRole>
        }
      />
      {/* Land everyone through the role-aware redirect. */}
      <Route
        path="*"
        element={
          loading ? (
            <FullPage>Loading…</FullPage>
          ) : user ? (
            <Navigate to={homePathFor(user.role)} replace />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />
    </Routes>
  );
}
