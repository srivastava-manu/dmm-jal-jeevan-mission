import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { REPO_ROOT } from "../config.js";

// Generates a numbered model migration from the authoritative dmm-model.js. The OUTPUT
// is plain SQL, checked into the repo, so NIC reviews exactly what runs — but it is
// provably derived from the model content rather than hand-transcribed. The original
// model keeps its default output; new versions set MODEL_MIGRATION_FILE to a new filename.

interface Capability {
  n: string;
  m: string;
  inc: string[];
}
interface Layer {
  name: string;
  covers: string;
  caps: Capability[];
}
interface DmmModel {
  MODEL_VERSION: string;
  LAYERS: Layer[];
}

async function loadModel(): Promise<DmmModel> {
  const code = await fs.readFile(path.join(REPO_ROOT, "dmm-model.js"), "utf8");
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.DMM_MODEL as DmmModel;
}

/** Single-quoted SQL string literal with quotes doubled. */
function lit(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

function arrayLit(items: string[]): string {
  if (items.length === 0) return "ARRAY[]::text[]";
  return "ARRAY[" + items.map(lit).join(", ") + "]::text[]";
}

async function main(): Promise<void> {
  const model = await loadModel();
  const version = model.MODEL_VERSION;
  const outputName = process.env.MODEL_MIGRATION_FILE ?? "004_seed_model.sql";
  if (!/^[0-9]{3}_[A-Za-z0-9._-]+\.sql$/.test(outputName)) {
    throw new Error("MODEL_MIGRATION_FILE must be a numbered migration filename such as 010_seed_model_v2_2.sql");
  }

  const lines: string[] = [];
  lines.push(`-- ${outputName}`);
  lines.push(
    `-- GENERATED from dmm-model.js by server/src/scripts/gen-model-migration.ts — do not edit by hand.`,
  );
  lines.push(
    `-- Seeds model version ${version} and its capabilities. Idempotent (ON CONFLICT DO NOTHING)`,
  );
  lines.push(
    `-- and append-only: a model revision adds a NEW version and NEW capability rows; existing`,
  );
  lines.push(
    `-- rows are never edited, so past assessments keep resolving against their exact wording.`,
  );
  lines.push(``);
  lines.push(`INSERT INTO model_versions (version, notes)`);
  lines.push(`VALUES (${lit(version)}, ${lit("Imported from dmm-model.js")})`);
  lines.push(`ON CONFLICT (version) DO NOTHING;`);
  lines.push(``);

  let count = 0;
  for (let li = 0; li < model.LAYERS.length; li++) {
    const layer = model.LAYERS[li]!;
    lines.push(`-- Layer ${li}: ${layer.name}`);
    for (let oi = 0; oi < layer.caps.length; oi++) {
      const cap = layer.caps[oi]!;
      lines.push(
        `INSERT INTO capabilities ` +
          `(model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)`,
      );
      lines.push(
        `SELECT mv.id, ${li}, ${lit(layer.name)}, ${lit(layer.covers)}, ${oi}, ` +
          `${lit(cap.n)}, ${lit(cap.m)}, ${arrayLit(cap.inc)}`,
      );
      lines.push(`FROM model_versions mv WHERE mv.version = ${lit(version)}`);
      lines.push(`ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;`);
      lines.push(``);
      count++;
    }
  }

  const out = path.join(REPO_ROOT, "migrations", outputName);
  await fs.writeFile(out, lines.join("\n"), "utf8");
  console.log(
    `Wrote ${path.relative(REPO_ROOT, out)} — ${version}, ` +
      `${model.LAYERS.length} layers, ${count} capabilities.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
