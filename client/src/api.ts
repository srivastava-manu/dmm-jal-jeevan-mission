export type Role = "state_assessor" | "centre";

export interface SessionUser {
  id?: string;
  name: string;
  email: string;
  role: Role;
  designation: string | null;
  stateId: string | null;
}

export interface AuthResult {
  user: SessionUser;
  redirect: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include", // send/receive the httpOnly session cookie
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  me(): Promise<AuthResult> {
    return request<AuthResult>("/api/auth/me");
  },
  login(email: string, password: string): Promise<AuthResult> {
    return request<AuthResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  logout(): Promise<{ ok: true }> {
    return request<{ ok: true }>("/api/auth/logout", { method: "POST" });
  },
  centreDashboard(): Promise<import("./model").NationalDashboard> {
    return request("/api/centre/dashboard");
  },
};
