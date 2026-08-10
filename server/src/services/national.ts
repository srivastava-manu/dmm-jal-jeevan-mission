import type { NationalCapabilityMean } from "../db/index.js";

// Pure derivation of the national summary from per-capability means. Per the README,
// derived values are computed, never stored — and NOTHING here hardcodes the shape of the
// model. The capability count, per-layer maxima and overall maximum are all derived from
// the rows that belong to this assessment's model version, so a future model revision
// (more/fewer capabilities or layers) does not break the arithmetic.
//
// The only scale constant is the rating ceiling: scores run 0..4, so a single capability
// contributes at most MAX_SCORE. That is the rating scale itself, not the model's shape.
export const MAX_SCORE = 4;

export interface Band {
  max: number;
  name: string;
}

// From dmm-model.js BANDS. Fixed presentation thresholds on the percentage.
export const BANDS: Band[] = [
  { max: 20, name: "Nascent" },
  { max: 40, name: "Emerging" },
  { max: 60, name: "Developing" },
  { max: 80, name: "Mature" },
  { max: 100, name: "Leading" },
];

export function bandFor(pct: number): string {
  return (BANDS.find((b) => pct <= b.max) ?? BANDS[BANDS.length - 1]!).name;
}

export interface LayerSummary {
  layerIndex: number;
  layerName: string;
  capabilityCount: number;
  score: number; // sum of the layer's capability means
  outOf: number; // capabilityCount * MAX_SCORE
  pct: number;
  band: string;
}

export interface Extreme {
  layerName: string;
  score: number;
  outOf: number;
}

export interface NationalDashboard {
  modelVersion: string;
  capabilityCount: number;
  submittedStates: number;
  assessorStates: number;
  overall: { score: number; outOf: number; pct: number; band: string };
  weakestLayer: Extreme | null;
  strongestLayer: Extreme | null;
  layers: LayerSummary[];
  grid: NationalCapabilityMean[];
}

export function buildNationalDashboard(input: {
  modelVersion: string;
  means: NationalCapabilityMean[];
  submittedStates: number;
  assessorStates: number;
}): NationalDashboard {
  const { means, modelVersion, submittedStates, assessorStates } = input;

  // Group means by layer, preserving each layer's real capability count.
  const byLayer = new Map<number, NationalCapabilityMean[]>();
  for (const m of means) {
    const arr = byLayer.get(m.layer_index) ?? [];
    arr.push(m);
    byLayer.set(m.layer_index, arr);
  }

  const layers: LayerSummary[] = [...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layerIndex, caps]) => {
      const capabilityCount = caps.length;
      const outOf = capabilityCount * MAX_SCORE; // derived, not literal 24
      const score = caps.reduce((sum, c) => sum + (c.mean ?? 0), 0);
      const pct = outOf === 0 ? 0 : (score / outOf) * 100;
      return {
        layerIndex,
        layerName: caps[0]!.layer_name,
        capabilityCount,
        score: round1(score),
        outOf,
        pct: Math.round(pct),
        band: bandFor(pct),
      };
    });

  const capabilityCount = means.length; // derived, not literal 48
  const overallOutOf = capabilityCount * MAX_SCORE; // derived, not literal 192
  const overallScore = means.reduce((sum, c) => sum + (c.mean ?? 0), 0);
  const overallPct = overallOutOf === 0 ? 0 : Math.round((overallScore / overallOutOf) * 100);

  const ranked = [...layers].sort((a, b) => a.pct - b.pct);
  const weakest = ranked[0] ?? null;
  const strongest = ranked[ranked.length - 1] ?? null;
  const toExtreme = (l: LayerSummary): Extreme => ({
    layerName: l.layerName,
    score: l.score,
    outOf: l.outOf,
  });

  return {
    modelVersion,
    capabilityCount,
    submittedStates,
    assessorStates,
    overall: {
      score: round1(overallScore),
      outOf: overallOutOf,
      pct: overallPct,
      band: bandFor(overallPct),
    },
    weakestLayer: weakest ? toExtreme(weakest) : null,
    strongestLayer: strongest ? toExtreme(strongest) : null,
    layers,
    grid: means,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
