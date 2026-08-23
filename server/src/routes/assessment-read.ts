import { asyncRouter } from "../http/async-route.js";
import { requireAuth } from "../http/require-auth.js";
import {
  getReadAssessment,
  getCapScoresForRead,
  getPreviousSubmitted,
  getStateHistory,
  type CapScoreRow,
} from "../db/index.js";
import { computeResults, computeCompare, type CapScore } from "../lib/scoring.js";

// Read-only screens (results / dashboard / compare). Only requireAuth — the same-state vs
// Centre visibility rule is enforced by RLS, not here, so an out-of-state assessor's read
// returns "not found" because the database returns no rows.
export const assessmentReadRouter = asyncRouter();
assessmentReadRouter.use(requireAuth);

function toCapScores(rows: CapScoreRow[]): CapScore[] {
  return rows.map((r) => ({
    capability_id: r.capability_id,
    layer_index: r.layer_index,
    layer_name: r.layer_name,
    order_in_layer: r.order_in_layer,
    name: r.name,
    value: r.value,
  }));
}

assessmentReadRouter.get("/:id/results", async (req, res) => {
  const ctx = req.auth!.ctx;
  const assessment = await getReadAssessment(ctx, req.params.id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  const caps = await getCapScoresForRead(ctx, assessment.id, assessment.model_version_id);
  const summary = computeResults(toCapScores(caps));

  // "Since <date>" card — only when an earlier submitted round exists.
  let since = null;
  const prev = await getPreviousSubmitted(ctx, assessment.id);
  if (prev) {
    const prevAssessment = await getReadAssessment(ctx, prev.id);
    if (prevAssessment) {
      const prevCaps = await getCapScoresForRead(ctx, prev.id, prevAssessment.model_version_id);
      const cmp = computeCompare(toCapScores(caps), toCapScores(prevCaps));
      since = {
        previousId: prev.id,
        previousDate: prev.submitted_at,
        deltaPoints: cmp.transition.delta,
        fromBand: cmp.transition.fromBand,
        toBand: cmp.transition.toBand,
        improved: cmp.improved,
        slipped: cmp.slipped,
      };
    }
  }

  res.json({ assessment, capabilities: caps, summary, since });
});

assessmentReadRouter.get("/:id/history", async (req, res) => {
  const ctx = req.auth!.ctx;
  const assessment = await getReadAssessment(ctx, req.params.id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  res.json(await getStateHistory(ctx, assessment.id));
});

assessmentReadRouter.get("/:id/compare", async (req, res) => {
  const ctx = req.auth!.ctx;
  const current = await getReadAssessment(ctx, req.params.id);
  if (!current) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }

  const toId = typeof req.query.to === "string" ? req.query.to : (await getPreviousSubmitted(ctx, current.id))?.id;
  if (!toId) {
    res.status(404).json({ error: "No earlier submitted assessment to compare against." });
    return;
  }
  const earlier = await getReadAssessment(ctx, toId);
  if (!earlier) {
    res.status(404).json({ error: "Comparison assessment not found." });
    return;
  }

  const [curCaps, earlierCaps] = await Promise.all([
    getCapScoresForRead(ctx, current.id, current.model_version_id),
    getCapScoresForRead(ctx, earlier.id, earlier.model_version_id),
  ]);
  const compare = computeCompare(toCapScores(curCaps), toCapScores(earlierCaps));

  res.json({
    current: { id: current.id, submitted_at: current.submitted_at, created_at: current.created_at, model_version: current.model_version },
    earlier: { id: earlier.id, submitted_at: earlier.submitted_at, model_version: earlier.model_version },
    compare,
  });
});
