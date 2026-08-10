// Presentation constants from the design tokens / dmm-model.js. The rating ramp is the
// one place colour is data.
export const SCORE_COLORS = [
  { bg: "#DE9D9B", fg: "#5c2320" }, // 0 Does not exist
  { bg: "#ECB576", fg: "#5f3a10" }, // 1 Under development
  { bg: "#FBE6A2", fg: "#5f4c0a" }, // 2 Pilot complete
  { bg: "#DCE9D5", fg: "#33502a" }, // 3 Functional at limited scale
  { bg: "#58A65C", fg: "#ffffff" }, // 4 Fully functional at state scale
];

export const SCALE_LABELS = [
  "Does not exist",
  "Under development",
  "Pilot complete",
  "Functional, limited scale",
  "Fully functional, state scale",
];

/** Colour a mean score (0–4, or null when no state has submitted this capability). */
export function colorForMean(mean: number | null): { bg: string; fg: string } {
  if (mean === null) return { bg: "#ffffff", fg: "#8794a0" };
  const idx = Math.max(0, Math.min(4, Math.round(mean)));
  return SCORE_COLORS[idx]!;
}

// ── Dashboard payload types (mirror server/src/services/national.ts) ──
export interface CapabilityMean {
  capability_id: string;
  layer_index: number;
  order_in_layer: number;
  layer_name: string;
  name: string;
  mean: number | null;
  contributing: number;
}

export interface LayerSummary {
  layerIndex: number;
  layerName: string;
  capabilityCount: number;
  score: number;
  outOf: number;
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
  grid: CapabilityMean[];
}
