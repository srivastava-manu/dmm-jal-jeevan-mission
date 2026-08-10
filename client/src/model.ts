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

// Full rating scale (from dmm-model.js SCALE) — presentation constant. `d` is the tooltip.
export const SCALE = [
  { n: 0, short: "Does not exist", d: "No digital system for this capability. Handled on paper, in spreadsheets, or not at all." },
  { n: 1, short: "Under development", d: "A system has been sanctioned, procured or is in development. Nothing is in productive use yet." },
  { n: 2, short: "Pilot complete", d: "Live and working with real data in a limited setting — one or a few districts, or a small user group — for at least one full reporting cycle. Not yet rolled out further." },
  { n: 3, short: "Functional, limited scale", d: "In routine production use across part of the state by the intended users. Gaps remain — some districts still manual, or some workflow steps still offline." },
  { n: 4, short: "Fully functional, state scale", d: "In routine use across effectively all districts by effectively all intended users. The data is authoritative, no parallel manual register is maintained, and the system is owned and monitored." },
];

/** The rating ceiling (scores run 0..MAX_SCORE). The only scale constant; counts derive. */
export const MAX_SCORE = 4;

// ── Assessment flow types (mirror server db/index.ts) ──
export interface AssessmentSummary {
  id: string;
  status: "draft" | "submitted";
  created_at: string;
  submitted_at: string | null;
  assessor_name: string | null;
  model_version: string;
  total: number;
  answered: number;
  score_so_far: number;
}

export interface Capability {
  id: string;
  layer_index: number;
  layer_name: string;
  layer_covers: string;
  order_in_layer: number;
  name: string;
  measure: string;
  includes: string[];
}

export interface EvidenceRow {
  system_id: string | null;
  districts_live: number | null;
  go_live: string | null;
}

export interface ScoreRow {
  score_id: string;
  capability_id: string;
  value: number | null;
  note: string | null;
  evidence: EvidenceRow | null;
}

export interface AssessmentDetail {
  assessment: {
    id: string;
    status: "draft" | "submitted";
    created_at: string;
    submitted_at: string | null;
    model_version_id: string;
    model_version: string;
  };
  capabilities: Capability[];
  scores: ScoreRow[];
  previous: { assessment_id: string; submitted_at: string; values: Record<string, number> } | null;
}

export interface SystemRow {
  id: string;
  name: string;
  districts_live: number | null;
  go_live: string | null;
}

export interface ReviewResult {
  total: number;
  answered: number;
  status: "draft" | "submitted";
  canSubmit: boolean;
  unanswered: { capability_id: string; name: string; layer_index: number; layer_name: string }[];
  evidenceGaps: {
    count: number;
    items: { capability_id: string; name: string; layer_name: string; value: number }[];
  };
  consistencyFlags: string[];
}

export interface BandDef {
  max: number;
  name: string;
}
export const BANDS: BandDef[] = [
  { max: 20, name: "Nascent" },
  { max: 40, name: "Emerging" },
  { max: 60, name: "Developing" },
  { max: 80, name: "Mature" },
  { max: 100, name: "Leading" },
];
export function bandFor(pct: number): string {
  return (BANDS.find((b) => pct <= b.max) ?? BANDS[BANDS.length - 1]!).name;
}

/** DD MMM YYYY, per the README copy rules. Accepts an ISO string or YYYY-MM-DD. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

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
