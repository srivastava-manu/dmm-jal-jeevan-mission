import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { fmtDate, type AssessorRow, type StateRef } from "../model";
import { CentreNav } from "../components/CentreNav";

interface DialogState {
  mode: "add" | "reassign";
  stateId: string;
}

// Screen 13 — State assessors. One assessor per state; Reassign when the officer changes.
export function CentreAssessors() {
  const [assessors, setAssessors] = useState<AssessorRow[]>([]);
  const [states, setStates] = useState<StateRef[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  async function load() {
    const [a, s] = await Promise.all([api.centre.assessors(), api.states()]);
    setAssessors(a.assessors);
    setStates(s.states);
  }
  useEffect(() => {
    void load();
  }, []);

  async function toggleAccess(a: AssessorRow) {
    await api.centre.setAccess(a.id, !a.active);
    void load();
  }

  return (
    <div className="page">
      <CentreNav active="assessors" />
      <main className="centre-assessors">
        <div className="assessors-head">
          <div>
            <h1>State assessors</h1>
            <p className="muted">
              One assessor per state. Reassign when the officer changes — past assessments keep
              the name of whoever submitted them.
            </p>
          </div>
          <button className="primary-btn" onClick={() => setDialog({ mode: "add", stateId: "" })}>
            Add a state assessor
          </button>
        </div>

        <div className="assessor-table">
          <div className="at-row at-head">
            <span>State / UT</span>
            <span>Assessor</span>
            <span>Last submitted</span>
            <span>Access</span>
            <span></span>
          </div>
          {assessors.map((a) => (
            <div className="at-row" key={a.id}>
              <span className="at-state">{a.state_name}</span>
              <span>
                <div>{a.name}</div>
                <div className="muted small">{a.email}</div>
              </span>
              <span className="muted">{a.last_submitted ? fmtDate(a.last_submitted) : "—"}</span>
              <span>
                <button
                  className={a.active ? "access-pill active" : "access-pill disabled"}
                  onClick={() => toggleAccess(a)}
                >
                  {a.active ? "Active" : "Disabled"}
                </button>
              </span>
              <span>
                <button className="ghost small" onClick={() => setDialog({ mode: "reassign", stateId: a.state_id })}>
                  Reassign
                </button>
              </span>
            </div>
          ))}
        </div>
      </main>

      {dialog && (
        <AssessorDialog
          mode={dialog.mode}
          initialStateId={dialog.stateId}
          states={states}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function AssessorDialog({
  mode,
  initialStateId,
  states,
  onClose,
  onDone,
}: {
  mode: "add" | "reassign";
  initialStateId: string;
  states: StateRef[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [stateId, setStateId] = useState(initialStateId);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stateId || !name.trim() || !email.trim()) {
      setError("State, name and email are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = { stateId, name: name.trim(), designation: designation.trim() || null, email: email.trim() };
    try {
      if (mode === "add") await api.centre.addAssessor(body);
      else await api.centre.reassign(body);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{mode === "add" ? "Add a state assessor" : "Reassign assessor"}</h2>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>
        <form className="assessor-form" onSubmit={submit}>
          <label>
            State / UT
            <select value={stateId} onChange={(e) => setStateId(e.target.value)} disabled={mode === "reassign"}>
              <option value="">Select a state or UT</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Required" />
          </label>
          <label>
            Designation
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. State IT Officer" />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Required" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary-btn full" type="submit" disabled={busy}>
            {mode === "add" ? "Add assessor" : "Reassign"}
          </button>
        </form>
      </div>
    </div>
  );
}
