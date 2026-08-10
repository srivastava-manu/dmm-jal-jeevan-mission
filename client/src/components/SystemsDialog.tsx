import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { SystemRow } from "../model";
import { fmtDate } from "../model";

// The state's systems, captured once and reused as evidence. Opened from Home ("Manage
// systems") and from a capability's evidence block ("+ Add a new system…"). When opened
// from a capability, `contextCapability` changes the hint and `onAdded` lets the caller
// attach the new system immediately.
export function SystemsDialog({
  open,
  onClose,
  onChanged,
  onAdded,
  contextCapability,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: (systems: SystemRow[]) => void;
  onAdded?: (system: SystemRow) => void;
  contextCapability?: string;
}) {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [name, setName] = useState("");
  const [districts, setDistricts] = useState("");
  const [goLive, setGoLive] = useState(""); // YYYY-MM
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) api.systems.list().then((r) => setSystems(r.systems)).catch(() => {});
  }, [open]);

  if (!open) return null;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("A system name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { system } = await api.systems.create({
        name: name.trim(),
        districts_live: districts === "" ? null : Number(districts),
        go_live: goLive === "" ? null : `${goLive}-01`,
      });
      const next = [...systems.filter((s) => s.id !== system.id), system].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      setSystems(next);
      onChanged?.(next);
      onAdded?.(system);
      setName("");
      setDistricts("");
      setGoLive("");
      if (onAdded) onClose(); // attaching to a capability — close straight after
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the system.");
    } finally {
      setBusy(false);
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
          {contextCapability
            ? `New systems are added to your list and attached to ${contextCapability} straight away.`
            : "The systems your state runs. Capture each once; attach them as evidence on scores of 3 and 4."}
        </p>

        <div className="systems-list">
          {systems.length === 0 && <p className="muted">No systems captured yet.</p>}
          {systems.map((s) => (
            <div className="system-row" key={s.id}>
              <span className="system-name">{s.name}</span>
              <span className="muted">
                {s.districts_live !== null ? `${s.districts_live} districts` : "—"}
                {s.go_live ? ` · live ${fmtDate(s.go_live)}` : ""}
              </span>
            </div>
          ))}
        </div>

        <form className="system-add" onSubmit={add}>
          <input
            placeholder="System name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            min={0}
            placeholder="Districts live"
            value={districts}
            onChange={(e) => setDistricts(e.target.value)}
          />
          <input
            type="month"
            aria-label="Go-live month"
            value={goLive}
            onChange={(e) => setGoLive(e.target.value)}
          />
          <button type="submit" disabled={busy}>Add</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
