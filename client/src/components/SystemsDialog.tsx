import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { SystemRow } from "../model";
import { fmtDate } from "../model";

// Screen 11 — the state's systems, captured once and reused as evidence. Two entry points,
// same dialog: "Manage systems" from Home (browse / add / edit / delete) and a capability's
// evidence block (attach mode — the hint names the capability being evidenced).
export function SystemsDialog({
  open,
  onClose,
  onChanged,
  mode = "manage",
  contextCapability,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: (systems: SystemRow[]) => void;
  mode?: "manage" | "attach";
  contextCapability?: string;
  onAttach?: (systemId: string) => void;
}) {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [name, setName] = useState("");
  const [districts, setDistricts] = useState("");
  const [goLive, setGoLive] = useState(""); // YYYY-MM
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { systems } = await api.systems.list();
    setSystems(systems);
    onChanged?.(systems);
  }
  useEffect(() => {
    if (open) {
      void load();
      resetForm();
    }
  }, [open]);

  if (!open) return null;

  function resetForm() {
    setName("");
    setDistricts("");
    setGoLive("");
    setEditingId(null);
    setError(null);
  }

  function startEdit(s: SystemRow) {
    setEditingId(s.id);
    setName(s.name);
    setDistricts(s.districts_live === null ? "" : String(s.districts_live));
    setGoLive(s.go_live ? s.go_live.slice(0, 7) : "");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("A system name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      districts_live: districts === "" ? null : Number(districts),
      go_live: goLive === "" ? null : `${goLive}-01`,
    };
    try {
      if (editingId) {
        await api.systems.edit(editingId, body);
        await load();
        resetForm();
      } else {
        const { system } = await api.systems.create(body);
        await load();
        resetForm();
        // Defensive: only attach if the server actually returned the created system.
        if (mode === "attach" && onAttach && system?.id) {
          onAttach(system.id);
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the system.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: SystemRow) {
    setError(null);
    try {
      await api.systems.remove(s.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the system.");
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Your systems</h2>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>
        <p className="muted">
          {mode === "attach" && contextCapability
            ? `Pick or add a system to evidence ${contextCapability}. Systems are added to your list and attached straight away.`
            : "The systems your state runs. Capture each once; attach them as evidence on scores of 3 and 4. Editing a system corrects it everywhere it is cited."}
        </p>

        <div className="systems-list">
          {systems.length === 0 && <p className="muted">No systems captured yet.</p>}
          {systems.map((s) => (
            <div className="system-row" key={s.id}>
              <div className="system-info">
                <span className="system-name">{s.name}</span>
                <span className="muted small">
                  {s.districts_live !== null ? `${s.districts_live} districts` : "—"}
                  {s.go_live ? ` · live ${fmtDate(s.go_live)}` : ""}
                  {s.in_use ? " · in use" : ""}
                </span>
              </div>
              <div className="system-actions">
                {mode === "attach" && onAttach && (
                  <button className="ghost small" onClick={() => { onAttach(s.id); onClose(); }}>Attach</button>
                )}
                <button className="ghost small" onClick={() => startEdit(s)}>Edit</button>
                {!s.in_use && (
                  <button className="ghost small danger" onClick={() => remove(s)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form className="system-add" onSubmit={submit}>
          <input placeholder="System name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" min={0} placeholder="Districts" value={districts} onChange={(e) => setDistricts(e.target.value)} />
          <input type="month" aria-label="Go-live month" value={goLive} onChange={(e) => setGoLive(e.target.value)} />
          <button type="submit" disabled={busy}>{editingId ? "Save" : "Add"}</button>
        </form>
        {editingId && (
          <button className="link-back" onClick={resetForm}>Cancel edit</button>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
