import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../http/require-auth.js";
import {
  listAssessments,
  createAssessment,
  deleteDraft,
  getAssessmentDetail,
  upsertScore,
  saveEvidence,
  reviewAssessment,
  submitAssessment,
  AssessmentLockedError,
  IncompleteAssessmentError,
} from "../db/index.js";
import { consistencyFlagsFromValues } from "../lib/scoring.js";

export const assessmentsRouter = Router();

// The whole assessment flow is a state_assessor capability, scoped to their own state.
assessmentsRouter.use(requireRole("state_assessor"));

assessmentsRouter.get("/", async (req, res) => {
  res.json({ assessments: await listAssessments(req.auth!.ctx) });
});

const startSchema = z.object({ mode: z.enum(["blank", "prefill"]) });

assessmentsRouter.post("/", async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "mode must be 'blank' or 'prefill'." });
    return;
  }
  const result = await createAssessment(req.auth!.ctx, parsed.data.mode);
  res.status(201).json(result);
});

assessmentsRouter.get("/:id", async (req, res) => {
  const detail = await getAssessmentDetail(req.auth!.ctx, req.params.id);
  if (!detail) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  res.json(detail);
});

// Authoritative review data — the front end trusts these counts, never its own.
assessmentsRouter.get("/:id/review", async (req, res) => {
  const review = await reviewAssessment(req.auth!.ctx, req.params.id);
  if (!review) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  res.json({
    total: review.total,
    answered: review.answered,
    status: review.status,
    canSubmit: review.status === "draft" && review.answered === review.total,
    unanswered: review.unanswered,
    evidenceGaps: { count: review.evidenceGaps.length, items: review.evidenceGaps },
    consistencyFlags: consistencyFlagsFromValues(new Map(Object.entries(review.valuesByName))),
  });
});

assessmentsRouter.post("/:id/submit", async (req, res) => {
  const profile = req.auth!.profile;
  try {
    const result = await submitAssessment(
      req.auth!.ctx,
      req.params.id,
      profile.name,
      profile.designation,
    );
    res.json(result);
  } catch (e) {
    if (e instanceof IncompleteAssessmentError) {
      res.status(409).json({
        error: "A partial assessment distorts the index — answer every capability before submitting.",
        answered: e.answered,
        total: e.total,
      });
      return;
    }
    res.status(400).json({ error: (e as Error).message });
  }
});

assessmentsRouter.delete("/:id", async (req, res) => {
  const ok = await deleteDraft(req.auth!.ctx, req.params.id);
  if (!ok) {
    res.status(404).json({ error: "No such draft to delete." });
    return;
  }
  res.json({ ok: true });
});

// value: 0..4 or null (null = unanswered). 0 is a valid answer, never treated as empty.
const scoreSchema = z.object({
  value: z.union([z.number().int().min(0).max(4), z.null()]),
  note: z.string().nullable().optional(),
});

assessmentsRouter.put("/:id/scores/:capabilityId", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "value must be an integer 0–4, or null." });
    return;
  }
  try {
    const saved = await upsertScore(
      req.auth!.ctx,
      req.params.id,
      req.params.capabilityId,
      parsed.data.value,
      parsed.data.note ?? null,
    );
    res.json(saved);
  } catch (e) {
    if (e instanceof AssessmentLockedError) {
      res.status(403).json({ error: e.message, lockedAt: e.lockedAt });
      return;
    }
    // RLS also rejects writes to a locked/foreign assessment independently.
    res.status(403).json({ error: "This assessment can no longer be edited." });
  }
});

const evidenceSchema = z.object({
  system_id: z.string().uuid().nullable(),
  districts_live: z.number().int().min(0).nullable(),
  go_live: z.string().nullable(), // YYYY-MM-DD or null
});

assessmentsRouter.put("/:id/scores/:capabilityId/evidence", async (req, res) => {
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid evidence." });
    return;
  }
  try {
    const ok = await saveEvidence(
      req.auth!.ctx,
      req.params.id,
      req.params.capabilityId,
      parsed.data,
    );
    if (!ok) {
      res.status(404).json({ error: "Score the capability before adding evidence." });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof AssessmentLockedError) {
      res.status(403).json({ error: e.message, lockedAt: e.lockedAt });
      return;
    }
    res.status(403).json({ error: "This assessment can no longer be edited." });
  }
});
