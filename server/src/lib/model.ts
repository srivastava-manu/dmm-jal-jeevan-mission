import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { REPO_ROOT } from "../config.js";

// Loads the authoritative model constants from dmm-model.js (the same file that seeds the
// capabilities). The bands (maturity thresholds), the scale and therefore the per-capability
// maximum all come from here — never hardcoded — so a model revision flows through.

export interface ModelData {
  MODEL_VERSION: string;
  SCALE: { n: number; short: string; d: string }[];
  BANDS: { max: number; name: string }[];
  LAYERS: { name: string; covers: string; caps: { n: string; m: string; inc: string[] }[] }[];
}

let cached: ModelData | null = null;

export function model(): ModelData {
  if (cached) return cached;
  const code = fs.readFileSync(path.join(REPO_ROOT, "dmm-model.js"), "utf8");
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  cached = sandbox.window.DMM_MODEL as ModelData;
  return cached;
}

/** Maximum score a single capability can carry: the scale runs 0..(len-1), so 4. */
export function perCapabilityMax(): number {
  return model().SCALE.length - 1;
}

/** First band whose ceiling covers the percentage. */
export function bandFor(pct: number): string {
  const bands = model().BANDS;
  return (bands.find((b) => pct <= b.max) ?? bands[bands.length - 1]!).name;
}
