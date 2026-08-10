import { useMemo } from "react";
import { colorForMean, type CapScoreRow } from "../model";

// The 8×6 maturity grid, shared by the results mini-grid / print grid and the dashboard.
// Cells are coloured by the capability's own score (0–4). Rows and columns follow the
// model's real shape — one row per layer, one column per capability position.
export function MaturityGrid({
  capabilities,
  variant,
  selectedId,
  onSelect,
}: {
  capabilities: CapScoreRow[];
  variant: "labelled" | "mini" | "interactive";
  selectedId?: string | null;
  onSelect?: (capabilityId: string) => void;
}) {
  const rows = useMemo(() => {
    const byLayer = new Map<number, CapScoreRow[]>();
    for (const c of capabilities) {
      const arr = byLayer.get(c.layer_index) ?? [];
      arr.push(c);
      byLayer.set(c.layer_index, arr);
    }
    return [...byLayer.entries()].sort(([a], [b]) => a - b);
  }, [capabilities]);

  return (
    <div className={`mgrid mgrid-${variant}`}>
      {rows.map(([layerIndex, cells]) => (
        <div
          className="mgrid-row"
          key={layerIndex}
          style={
            variant === "mini"
              ? { gridTemplateColumns: `repeat(${cells.length}, 1fr)` }
              : { gridTemplateColumns: `150px repeat(${cells.length}, 1fr)` }
          }
        >
          {variant !== "mini" && (
            <div className="mgrid-rowlabel">
              <span className="mono">{layerIndex + 1}</span> {cells[0]!.layer_name}
            </div>
          )}
          {cells.map((cell) => {
            const col = colorForMean(cell.value);
            const selected = selectedId === cell.capability_id;
            const interactive = variant === "interactive";
            return (
              <div
                key={cell.capability_id}
                className={`mgrid-cell${selected ? " selected" : ""}${interactive ? " clickable" : ""}`}
                style={{ background: col.bg, color: col.fg }}
                onClick={interactive ? () => onSelect?.(cell.capability_id) : undefined}
                title={variant === "mini" ? `${cell.name}: ${cell.value ?? "—"}` : undefined}
              >
                {variant !== "mini" && (
                  <>
                    <span className="mgrid-name">{cell.name}</span>
                    <span className="mgrid-score mono">{cell.value ?? "—"}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
