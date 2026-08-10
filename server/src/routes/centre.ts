import { Router } from "express";
import { requireRole } from "../http/require-auth.js";
import {
  getCurrentModelVersion,
  getNationalCapabilityMeans,
  countSubmittedStates,
  countActiveAssessorStates,
} from "../db/index.js";
import { buildNationalDashboard } from "../services/national.js";

export const centreRouter = Router();

// The national dashboard. Guarded to the Centre role; every query runs in the Centre's
// RLS context, so drafts are invisible and non-submitting states are excluded by the
// database itself.
centreRouter.get("/dashboard", requireRole("centre"), async (req, res) => {
  const ctx = req.auth!.ctx;

  const mv = await getCurrentModelVersion(ctx);
  if (!mv) {
    res.status(503).json({ error: "No model version is published yet." });
    return;
  }

  const [means, submittedStates, assessorStates] = await Promise.all([
    getNationalCapabilityMeans(ctx, mv.id),
    countSubmittedStates(ctx),
    countActiveAssessorStates(ctx),
  ]);

  res.json(
    buildNationalDashboard({
      modelVersion: mv.version,
      means,
      submittedStates,
      assessorStates,
    }),
  );
});
