import { perCapabilityMax, bandFor } from "./model.js";

// National aggregation for the Centre. Reuses scoring's band/max (no second scoring path).
// Every number is a real count over each state's LATEST submitted assessment — no
// placeholders, honest with thin data. Maxima derive from the capability count × the scale
// ceiling.

export interface CellRow {
  capability_id: string;
  layer_index: number;
  order_in_layer: number;
  layer_name: string;
  name: string;
  measure: string;
  value: number;
  state_id: string;
  state_name: string;
  assessment_id: string;
}

export interface StateRef {
  state_id: string;
  state_name: string;
  assessment_id: string;
}

export interface LevelBucket {
  level: number;
  count: number;
  states: StateRef[];
}

export interface CapabilityCell {
  capability_id: string;
  layer_index: number;
  order_in_layer: number;
  layer_name: string;
  name: string;
  measure: string;
  mean: number | null; // null when no submitted state has this capability
  contributing: number;
  distribution: LevelBucket[]; // levels 0..maxScore
  atOrAbove3: number; // states at level 3 or 4 (for the requests "national line")
}

export interface LayerIndex {
  layer_index: number;
  layer_name: string;
  score: number;
  outOf: number;
  pct: number;
  band: string;
}

export interface NationalDashboard {
  totalStates: number;
  statesWithAssessor: number;
  submittedStates: number;
  excludedCapabilities: number;
  overall: { score: number; outOf: number; pct: number; band: string };
  layers: LayerIndex[];
  weakestLayer: LayerIndex | null;
  grid: CapabilityCell[];
  overallDistribution: LevelBucket[]; // states grouped by their modal score
  openRequests: number;
  newRequests: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Most common value; ties resolve to the higher level for determinism. */
function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = -1;
  let bestCount = -1;
  for (const [level, count] of counts) {
    if (count > bestCount || (count === bestCount && level > best)) {
      best = level;
      bestCount = count;
    }
  }
  return best;
}

export function computeNationalDashboard(input: {
  rows: CellRow[];
  totalStates: number;
  statesWithAssessor: number;
  submittedStates: number;
  excludedCapabilities: number;
  openRequests: number;
  newRequests: number;
}): NationalDashboard {
  const cap = perCapabilityMax();
  const levels = Array.from({ length: cap + 1 }, (_, i) => i);

  // Group rows by capability (preserving grid order).
  const byCap = new Map<string, CellRow[]>();
  const order: string[] = [];
  for (const r of input.rows) {
    if (!byCap.has(r.capability_id)) {
      byCap.set(r.capability_id, []);
      order.push(r.capability_id);
    }
    byCap.get(r.capability_id)!.push(r);
  }

  const grid: CapabilityCell[] = order
    .map((id) => byCap.get(id)!)
    .sort((a, b) => a[0]!.layer_index - b[0]!.layer_index || a[0]!.order_in_layer - b[0]!.order_in_layer)
    .map((rows) => {
      const first = rows[0]!;
      const values = rows.map((r) => r.value);
      const mean = values.length ? round1(values.reduce((s, v) => s + v, 0) / values.length) : null;
      const distribution: LevelBucket[] = levels.map((level) => {
        const at = rows.filter((r) => r.value === level);
        return {
          level,
          count: at.length,
          states: at.map((r) => ({ state_id: r.state_id, state_name: r.state_name, assessment_id: r.assessment_id })),
        };
      });
      const atOrAbove3 = rows.filter((r) => r.value >= 3).length;
      return {
        capability_id: first.capability_id,
        layer_index: first.layer_index,
        order_in_layer: first.order_in_layer,
        layer_name: first.layer_name,
        name: first.name,
        measure: first.measure,
        mean,
        contributing: values.length,
        distribution,
        atOrAbove3,
      };
    });

  // Per-layer index = sum of that layer's capability means.
  const byLayer = new Map<number, CapabilityCell[]>();
  for (const c of grid) {
    if (!byLayer.has(c.layer_index)) byLayer.set(c.layer_index, []);
    byLayer.get(c.layer_index)!.push(c);
  }
  const layers: LayerIndex[] = [...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layer_index, cells]) => {
      const score = cells.reduce((s, c) => s + (c.mean ?? 0), 0);
      const outOf = cells.length * cap;
      const pct = outOf === 0 ? 0 : (score / outOf) * 100;
      return {
        layer_index,
        layer_name: cells[0]!.layer_name,
        score: round1(score),
        outOf,
        pct: Math.round(pct),
        band: bandFor(pct),
      };
    });

  const overallScore = grid.reduce((s, c) => s + (c.mean ?? 0), 0);
  const overallOutOf = grid.length * cap;
  const overallPct = overallOutOf === 0 ? 0 : Math.round((overallScore / overallOutOf) * 100);
  const ranked = [...layers].sort((a, b) => a.pct - b.pct);

  // Per-state modal score → group states for the all-capability rail distribution.
  const stateValues = new Map<string, { name: string; assessment_id: string; values: number[] }>();
  for (const r of input.rows) {
    if (!stateValues.has(r.state_id)) {
      stateValues.set(r.state_id, { name: r.state_name, assessment_id: r.assessment_id, values: [] });
    }
    stateValues.get(r.state_id)!.values.push(r.value);
  }
  const overallDistribution: LevelBucket[] = levels.map((level) => ({ level, count: 0, states: [] }));
  for (const [state_id, { name, assessment_id, values }] of stateValues) {
    const m = mode(values);
    if (m !== null) {
      const bucket = overallDistribution[m]!;
      bucket.count += 1;
      bucket.states.push({ state_id, state_name: name, assessment_id });
    }
  }

  return {
    totalStates: input.totalStates,
    statesWithAssessor: input.statesWithAssessor,
    submittedStates: input.submittedStates,
    excludedCapabilities: input.excludedCapabilities,
    overall: { score: round1(overallScore), outOf: overallOutOf, pct: overallPct, band: bandFor(overallPct) },
    layers,
    weakestLayer: ranked[0] ?? null,
    grid,
    overallDistribution,
    openRequests: input.openRequests,
    newRequests: input.newRequests,
  };
}
