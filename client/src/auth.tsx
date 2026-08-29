import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type SessionUser, type Features } from "./api";

/** Everything off until the server says otherwise, so a failed load never reveals a feature. */
const NO_FEATURES: Features = { supportRequests: false };

interface AuthState {
  user: SessionUser | null;
  features: Features;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  setFeatures: (f: Features) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [features, setFeatures] = useState<Features>(NO_FEATURES);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await api.me();
      setUser(res.user);
      setFeatures(res.features ?? NO_FEATURES);
    } catch {
      setUser(null);
      setFeatures(NO_FEATURES);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, features, loading, setUser, setFeatures, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** The single source of truth for where each role lands after sign-in. */
export function homePathFor(role: SessionUser["role"]): string {
  return role === "centre" ? "/dashboard" : "/home";
}
