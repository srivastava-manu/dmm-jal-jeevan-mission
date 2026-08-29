import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, homePathFor } from "./auth";
import { SignIn } from "./pages/SignIn";
import { Home } from "./pages/Home";
import { StartAssessment } from "./pages/StartAssessment";
import { Assess } from "./pages/Assess";
import { Review } from "./pages/Review";
import { Results } from "./pages/Results";
import { AssessorDashboard } from "./pages/AssessorDashboard";
import { Compare } from "./pages/Compare";
import { About } from "./pages/About";
import { Dashboard } from "./pages/Dashboard";
import { CentreAssessors } from "./pages/CentreAssessors";
import { CentreRequests } from "./pages/CentreRequests";
import { StateDetail } from "./pages/StateDetail";
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

/** Sends the user away from a route whose feature is switched off. */
function RequireFeature({
  enabled,
  fallback,
  children,
}: {
  enabled: boolean;
  fallback: string;
  children: React.ReactNode;
}) {
  if (!enabled) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}

export function App() {
  const { user, loading, features } = useAuth();

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

      {/* State assessor flow */}
      <Route
        path="/home"
        element={
          <RequireRole role="state_assessor">
            <Home />
          </RequireRole>
        }
      />
      <Route
        path="/home/start"
        element={
          <RequireRole role="state_assessor">
            <StartAssessment />
          </RequireRole>
        }
      />
      <Route
        path="/assessment/:id"
        element={
          <RequireRole role="state_assessor">
            <Assess />
          </RequireRole>
        }
      />
      <Route
        path="/assessment/:id/review"
        element={
          <RequireRole role="state_assessor">
            <Review />
          </RequireRole>
        }
      />
      <Route
        path="/assessment/:id/results"
        element={
          <RequireRole role="state_assessor">
            <Results />
          </RequireRole>
        }
      />
      <Route
        path="/assessment/:id/dashboard"
        element={
          <RequireRole role="state_assessor">
            <AssessorDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/assessment/:id/compare"
        element={
          <RequireRole role="state_assessor">
            <Compare />
          </RequireRole>
        }
      />
      {/* About the model is public — reachable without signing in (README §10). */}
      <Route path="/about" element={<About />} />

      {/* Centre */}
      <Route
        path="/dashboard"
        element={
          <RequireRole role="centre">
            <Dashboard />
          </RequireRole>
        }
      />
      <Route
        path="/centre/assessors"
        element={
          <RequireRole role="centre">
            <CentreAssessors />
          </RequireRole>
        }
      />
      <Route
        path="/centre/requests"
        element={
          <RequireRole role="centre">
            <RequireFeature enabled={features.supportRequests} fallback="/dashboard">
              <CentreRequests />
            </RequireFeature>
          </RequireRole>
        }
      />
      <Route
        path="/state/:id"
        element={
          <RequireRole role="centre">
            <StateDetail />
          </RequireRole>
        }
      />

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
