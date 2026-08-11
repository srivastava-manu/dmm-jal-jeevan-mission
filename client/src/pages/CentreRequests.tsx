import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { colorForMean, SCALE, fmtDate, type SupportRequestRow } from "../model";
import { CentreNav } from "../components/CentreNav";

const STATUSES = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "closed", label: "Closed" },
] as const;

const STATUS_LABEL: Record<SupportRequestRow["status"], string> = {
  new: "New",
  in_progress: "In progress",
  closed: "Closed",
};

// Screen 14 — Requests. The Centre reads all requests and sets status + reply.
export function CentreRequests() {
  const [requests, setRequests] = useState<SupportRequestRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stat, setStat] = useState<{ atOrAbove3: number; total: number } | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<SupportRequestRow["status"]>("new");

  async function load() {
    const { requests } = await api.centre.requests();
    setRequests(requests);
  }
  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(() => requests.find((r) => r.id === selectedId) ?? null, [requests, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setReplyDraft(selected.reply ?? "");
    setStatusDraft(selected.status);
    api.centre.capabilityStat(selected.capability_name).then(setStat).catch(() => setStat(null));
  }, [selected]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length, new: 0, in_progress: 0, closed: 0 };
    for (const r of requests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [requests]);

  const shown = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  async function save() {
    if (!selected) return;
    await api.centre.updateRequest(selected.id, { status: statusDraft, reply: replyDraft });
    await load();
  }

  return (
    <div className="page">
      <CentreNav active="requests" />
      <main className="centre-requests">
        <div className="req-layout">
          <div className="req-main">
            <div className="filter-chips">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  className={filter === s.key ? "filter-chip on" : "filter-chip"}
                  onClick={() => setFilter(s.key)}
                >
                  {s.label} <span className="mono">{counts[s.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 && <p className="muted">No requests.</p>}
            <div className="req-cards">
              {shown.map((r) => (
                <button
                  key={r.id}
                  className={`req-card${selectedId === r.id ? " selected" : ""}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <span className="swatch" style={{ background: colorForMean(r.score_value).bg, color: colorForMean(r.score_value).fg }}>
                    {r.score_value ?? "—"}
                  </span>
                  <div className="req-body">
                    <div className="req-top">
                      <span className="req-cap">{r.capability_name}</span>
                      <span className={`status-pill ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    </div>
                    <div className="muted small">{r.state_name} · {r.layer_name} · raised {fmtDate(r.created_at)}</div>
                    {r.message && <div className="req-note">{r.message}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside className="req-rail">
            {!selected ? (
              <p className="muted">Select a request to respond.</p>
            ) : (
              <>
                <div className="muted small">{selected.state_name} · {selected.layer_name}</div>
                <h2 className="rail-title">{selected.capability_name}</h2>
                <div className="rail-score">
                  <span className="swatch" style={{ background: colorForMean(selected.score_value).bg, color: colorForMean(selected.score_value).fg }}>
                    {selected.score_value ?? "—"}
                  </span>
                  <span>{selected.score_value !== null ? SCALE[selected.score_value]!.short : ""}</span>
                </div>

                <div className="said-box">
                  <span className="section-label">What the state said</span>
                  <p>{selected.message ?? "—"}</p>
                </div>

                {stat && (
                  <p className="muted small">
                    {stat.atOrAbove3} of {stat.total} states are at 3 or above on this capability.
                  </p>
                )}

                <div className="status-setter">
                  {(["new", "in_progress", "closed"] as const).map((s) => (
                    <button
                      key={s}
                      className={statusDraft === s ? "status-btn on" : "status-btn"}
                      onClick={() => setStatusDraft(s)}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>

                <textarea
                  className="reply-box"
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Reply to the state…"
                  rows={4}
                />
                <button className="primary-btn full" onClick={save}>Save reply</button>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
