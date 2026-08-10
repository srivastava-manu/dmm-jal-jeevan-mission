import { perCapabilityMax, bandFor } from "./model.js";

// The ONE module that turns capability scores into every derived number the read screens
// show: totals, percentages, bands, per-layer index, strongest/weakest layer, top-four
// strengths, bottom-four focus, consistency flags, and cross-version comparison. The front
// end renders these; it computes nothing. Maxima derive from the capability count times the
// scale ceiling — never a hardcoded 192/24.

export interface CapScore {
  capability_id: string;
  layer_index: number;
  layer_name: string;
  order_in_layer: number;
  name: string;
  value: number | null; // null = unanswered; 0 is a real answer
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Stable ordering key: layer first, then position within the layer. */
const posKey = (c: CapScore) => c.layer_index * 1000 + c.order_in_layer;

// ── Results summary ──────────────────────────────────────────────────────────

export interface LayerIndexRow {
  layer_index: number;
  layer_name: string;
  score: number;
  max: number;
  pct: number;
  band: string;
}

export interface CapRef {
  capability_id: string;
  name: string;
  layer_name: string;
  value: number;
}

export interface ResultsSummary {
  total: number; // capability count
  answered: number;
  overallScore: number;
  overallMax: number; // total * perCapabilityMax
  overallPct: number;
  overallBand: string;
  layers: LayerIndexRow[];
  strongestLayer: LayerIndexRow;
  weakestLayer: LayerIndexRow;
  strengths: CapRef[]; // four highest, ties by layer then position
  focus: CapRef[]; // four lowest, ties by layer then position
  consistencyFlags: string[];
}

export function computeResults(caps: CapScore[]): ResultsSummary {
  const cap = perCapabilityMax();
  const total = caps.length;
  const answered = caps.filter((c) => c.value !== null).length;
  const overallScore = caps.reduce((s, c) => s + (c.value ?? 0), 0);
  const overallMax = total * cap;
  const overallPct = overallMax === 0 ? 0 : Math.round((overallScore / overallMax) * 100);

  // Per-layer index.
  const byLayer = new Map<number, CapScore[]>();
  for (const c of caps) {
    const arr = byLayer.get(c.layer_index) ?? [];
    arr.push(c);
    byLayer.set(c.layer_index, arr);
  }
  const layers: LayerIndexRow[] = [...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layer_index, cs]) => {
      const score = cs.reduce((s, c) => s + (c.value ?? 0), 0);
      const max = cs.length * cap;
      const pct = max === 0 ? 0 : (score / max) * 100;
      return {
        layer_index,
        layer_name: cs[0]!.layer_name,
        score: round1(score),
        max,
        pct: Math.round(pct),
        band: bandFor(pct),
      };
    });

  // Strongest = highest pct, weakest = lowest; ties resolve by layer order for stability.
  const byPct = [...layers].sort((a, b) => b.pct - a.pct || a.layer_index - b.layer_index);
  const strongestLayer = byPct[0]!;
  const weakestLayer = byPct[byPct.length - 1]!;

  // Strengths / focus over answered capabilities. Ties break by layer then position so the
  // list is deterministic.
  const answeredCaps = caps.filter((c) => c.value !== null) as (CapScore & { value: number })[];
  const strong = [...answeredCaps].sort((a, b) => b.value - a.value || posKey(a) - posKey(b));
  const weak = [...answeredCaps].sort((a, b) => a.value - b.value || posKey(a) - posKey(b));
  const toRef = (c: CapScore & { value: number }): CapRef => ({
    capability_id: c.capability_id,
    name: c.name,
    layer_name: c.layer_name,
    value: c.value,
  });

  return {
    total,
    answered,
    overallScore: round1(overallScore),
    overallMax,
    overallPct,
    overallBand: bandFor(overallPct),
    layers,
    strongestLayer,
    weakestLayer,
    strengths: strong.slice(0, 4).map(toRef),
    focus: weak.slice(0, 4).map(toRef),
    consistencyFlags: computeConsistencyFlags(caps),
  };
}

// ── Consistency flags (moved here from Step 4) ───────────────────────────────

interface ConsistencyRule {
  high: string;
  needs: string;
}
const CONSISTENCY_RULES: ConsistencyRule[] = [
  { high: "Water Service Intelligence", needs: "Data Infrastructure" },
  { high: "Interoperability & Open Integration", needs: "Network & Connectivity" },
  { high: "Intelligent Automation & Decision Support", needs: "Data Management & Governance" },
];
const HIGH_THRESHOLD = 3;
const LOW_THRESHOLD = 1;

export function consistencyFlagsFromValues(byName: Map<string, number>): string[] {
  const flags: string[] = [];
  for (const rule of CONSISTENCY_RULES) {
    const hi = byName.get(rule.high);
    const lo = byName.get(rule.needs);
    if (hi === undefined || lo === undefined) continue;
    if (hi >= HIGH_THRESHOLD && lo <= LOW_THRESHOLD) {
      flags.push(`${rule.high} is ${hi} but ${rule.needs} is ${lo}.`);
    }
  }
  return flags;
}

export function computeConsistencyFlags(caps: CapScore[]): string[] {
  return consistencyFlagsFromValues(
    new Map(caps.filter((c) => c.value !== null).map((c) => [c.name, c.value!])),
  );
}

// ── Cross-version compare ────────────────────────────────────────────────────

export interface Move {
  name: string;
  layer_name: string;
  from: number;
  to: number;
  delta: number;
}

export interface NotComparable {
  name: string;
  layer_name: string;
  status: "added" | "retired"; // added: only in current; retired: only in earlier
}

export interface CompareResult {
  comparableCount: number;
  improved: number;
  same: number;
  slipped: number;
  biggestMoves: Move[];
  notComparable: NotComparable[];
  transition: { from: number; to: number; delta: number; fromBand: string; toBand: string; max: number };
}

/**
 * Compare a current assessment (`a`) against an earlier one (`b`). Capabilities are matched
 * by NAME — the stable cross-version identity — because the README treats a reworded
 * capability as new, not as movement. Names present in only one version are notComparable
 * (added / retired) and are excluded from moves and from the improved/same/slipped counts.
 * The overall transition is computed over the comparable set only, so it is apples-to-apples
 * across versions.
 */
export function computeCompare(a: CapScore[], b: CapScore[]): CompareResult {
  const aByName = new Map(a.map((c) => [c.name, c]));
  const bByName = new Map(b.map((c) => [c.name, c]));

  const notComparable: NotComparable[] = [];
  for (const c of a) if (!bByName.has(c.name)) notComparable.push({ name: c.name, layer_name: c.layer_name, status: "added" });
  for (const c of b) if (!aByName.has(c.name)) notComparable.push({ name: c.name, layer_name: c.layer_name, status: "retired" });

  let improved = 0;
  let same = 0;
  let slipped = 0;
  let aScore = 0;
  let bScore = 0;
  let comparableCount = 0;
  const moves: Move[] = [];

  for (const [name, ac] of aByName) {
    const bc = bByName.get(name);
    if (!bc) continue; // added — handled above
    if (ac.value === null || bc.value === null) continue; // need both answered to compare
    comparableCount++;
    aScore += ac.value;
    bScore += bc.value;
    const delta = ac.value - bc.value;
    if (delta > 0) improved++;
    else if (delta < 0) slipped++;
    else same++;
    if (delta !== 0) {
      moves.push({ name, layer_name: ac.layer_name, from: bc.value, to: ac.value, delta });
    }
  }

  moves.sort(
    (x, y) =>
      Math.abs(y.delta) - Math.abs(x.delta) ||
      (aByName.get(x.name)!.layer_index - aByName.get(y.name)!.layer_index) ||
      (aByName.get(x.name)!.order_in_layer - aByName.get(y.name)!.order_in_layer),
  );

  const cap = perCapabilityMax();
  const max = comparableCount * cap;
  const fromPct = max === 0 ? 0 : (bScore / max) * 100;
  const toPct = max === 0 ? 0 : (aScore / max) * 100;

  return {
    comparableCount,
    improved,
    same,
    slipped,
    biggestMoves: moves,
    notComparable,
    transition: {
      from: bScore,
      to: aScore,
      delta: aScore - bScore,
      fromBand: bandFor(fromPct),
      toBand: bandFor(toPct),
      max,
    },
  };
}
