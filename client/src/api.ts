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
  model(): Promise<import("./model").PublicModel> {
    return request("/api/model");
  },
  states(): Promise<{ states: import("./model").StateRef[] }> {
    return request("/api/states");
  },

  centre: {
    dashboard(): Promise<import("./model").CentreDashboard> {
      return request("/api/centre/dashboard");
    },
    assessors(): Promise<{ assessors: import("./model").AssessorRow[] }> {
      return request("/api/centre/assessors");
    },
    addAssessor(body: { stateId: string; name: string; designation: string | null; email: string }): Promise<{ id: string }> {
      return request("/api/centre/assessors", { method: "POST", body: JSON.stringify(body) });
    },
    setAccess(id: string, active: boolean): Promise<{ id: string; active: boolean }> {
      return request(`/api/centre/assessors/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
    },
    reassign(body: { stateId: string; name: string; designation: string | null; email: string }): Promise<{ id: string; moved: number }> {
      return request("/api/centre/reassign", { method: "POST", body: JSON.stringify(body) });
    },
    audit(): Promise<{ audit: import("./model").AuditRow[] }> {
      return request("/api/centre/audit");
    },
    requests(): Promise<{ requests: import("./model").SupportRequestRow[] }> {
      return request("/api/centre/requests");
    },
    updateRequest(id: string, body: { status?: string; reply?: string | null }): Promise<{ ok: true }> {
      return request(`/api/centre/requests/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    capabilityStat(name: string): Promise<{ atOrAbove3: number; total: number }> {
      return request(`/api/centre/capability-stat?name=${encodeURIComponent(name)}`);
    },
    resetPassword(id: string): Promise<{ tempPassword: string }> {
      return request(`/api/centre/assessors/${id}/reset-password`, { method: "POST" });
    },
    exportCsvUrl: "/api/centre/export.csv",
  },

  requests: {
    list(): Promise<{ requests: import("./model").SupportRequestRow[] }> {
      return request("/api/requests");
    },
    create(body: {
      assessmentId: string | null;
      capabilityId: string;
      scoreValue: number | null;
      message: string;
    }): Promise<{ id: string }> {
      return request("/api/requests", { method: "POST", body: JSON.stringify(body) });
    },
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
    setEvidence(id: string, capabilityId: string, systemId: string | null): Promise<{ ok: true }> {
      return request(`/api/assessments/${id}/scores/${capabilityId}/evidence`, {
        method: "PUT",
        body: JSON.stringify({ system_id: systemId }),
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
    edit(
      id: string,
      input: { name: string; districts_live: number | null; go_live: string | null },
    ): Promise<{ system: import("./model").SystemRow }> {
      return request(`/api/systems/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    remove(id: string): Promise<{ ok: true }> {
      return request(`/api/systems/${id}`, { method: "DELETE" });
    },
  },
};
