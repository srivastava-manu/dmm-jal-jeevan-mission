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
  model(): Promise<import("./model").PublicModel> {
    return request("/api/model");
  },

  assessments: {
    list(): Promise<{ assessments: import("./model").AssessmentSummary[] }> {
      return request("/api/assessments");
    },
    start(mode: "blank" | "prefill"): Promise<{ id: string; prefilledFrom: string | null }> {
      return request("/api/assessments", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
    },
    get(id: string): Promise<import("./model").AssessmentDetail> {
      return request(`/api/assessments/${id}`);
    },
    remove(id: string): Promise<{ ok: true }> {
      return request(`/api/assessments/${id}`, { method: "DELETE" });
    },
    saveScore(
      id: string,
      capabilityId: string,
      value: number | null,
      note?: string | null,
    ): Promise<{ score_id: string; value: number | null }> {
      return request(`/api/assessments/${id}/scores/${capabilityId}`, {
        method: "PUT",
        body: JSON.stringify({ value, note: note ?? null }),
      });
    },
    saveEvidence(
      id: string,
      capabilityId: string,
      ev: { system_id: string | null; districts_live: number | null; go_live: string | null },
    ): Promise<{ ok: true }> {
      return request(`/api/assessments/${id}/scores/${capabilityId}/evidence`, {
        method: "PUT",
        body: JSON.stringify(ev),
      });
    },
    review(id: string): Promise<import("./model").ReviewResult> {
      return request(`/api/assessments/${id}/review`);
    },
    submit(id: string): Promise<{ submitted_at: string; locked_at: string }> {
      return request(`/api/assessments/${id}/submit`, { method: "POST" });
    },
    results(id: string): Promise<import("./model").ResultsResponse> {
      return request(`/api/assessments/${id}/results`);
    },
    history(id: string): Promise<import("./model").HistoryResponse> {
      return request(`/api/assessments/${id}/history`);
    },
    compare(id: string, to?: string): Promise<import("./model").CompareResponse> {
      const q = to ? `?to=${encodeURIComponent(to)}` : "";
      return request(`/api/assessments/${id}/compare${q}`);
    },
  },

  systems: {
    list(): Promise<{ systems: import("./model").SystemRow[] }> {
      return request("/api/systems");
    },
    create(input: {
      name: string;
      districts_live: number | null;
      go_live: string | null;
    }): Promise<{ system: import("./model").SystemRow }> {
      return request("/api/systems", { method: "POST", body: JSON.stringify(input) });
    },
  },
};
