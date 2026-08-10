import type { NationalCapabilityMean } from "../db/index.js";

// Pure derivation of the national summary from per-capability means. Per the README:
// derived values are computed, never stored. Layer average = sum of its 6 capability
// means (out of 24); overall = sum of all 48 (out of 192); band from the percentage.

export interface Band {
  max: number;
  name: string;
}

// From dmm-model.js BANDS. These are fixed presentation thresholds.
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
  score: number; // out of 24
  pct: number;
  band: string;
}

export interface NationalDashboard {
  modelVersion: string;
  submittedStates: number;
  assessorStates: number;
  overall: { score: number; outOf: 192; pct: number; band: string };
  weakestLayer: { layerName: string; score: number } | null;
  strongestLayer: { layerName: string; score: number } | null;
  layers: LayerSummary[];
  grid: NationalCapabilityMean[]; // 48 cells, ordered by layer then position
}

export function buildNationalDashboard(input: {
  modelVersion: string;
  means: NationalCapabilityMean[];
  submittedStates: number;
  assessorStates: number;
}): NationalDashboard {
  const { means, modelVersion, submittedStates, assessorStates } = input;

  // Group means into 8 layers of 6.
  const byLayer = new Map<number, NationalCapabilityMean[]>();
  for (const m of means) {
    const arr = byLayer.get(m.layer_index) ?? [];
    arr.push(m);
    byLayer.set(m.layer_index, arr);
  }

  const layers: LayerSummary[] = [...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layerIndex, caps]) => {
      const score = caps.reduce((sum, c) => sum + (c.mean ?? 0), 0); // out of 24
      const pct = (score / 24) * 100;
      return {
        layerIndex,
        layerName: caps[0]!.layer_name,
        score: round1(score),
        pct: Math.round(pct),
        band: bandFor(pct),
      };
    });

  const overallScore = means.reduce((sum, c) => sum + (c.mean ?? 0), 0); // out of 192
  const overallPct = Math.round((overallScore / 192) * 100);

  const ranked = [...layers].sort((a, b) => a.score - b.score);
  const weakest = ranked[0] ?? null;
  const strongest = ranked[ranked.length - 1] ?? null;

  return {
    modelVersion,
    submittedStates,
    assessorStates,
    overall: {
      score: round1(overallScore),
      outOf: 192,
      pct: overallPct,
      band: bandFor(overallPct),
    },
    weakestLayer: weakest ? { layerName: weakest.layerName, score: weakest.score } : null,
    strongestLayer: strongest
      ? { layerName: strongest.layerName, score: strongest.score }
      : null,
    layers,
    grid: means,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
