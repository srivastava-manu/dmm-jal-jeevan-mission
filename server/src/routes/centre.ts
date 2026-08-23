import { asyncRouter } from "../http/async-route.js";
import { z } from "zod";
import { requireRole } from "../http/require-auth.js";
import {
  getCentreDashboardData,
  listAssessors,
  centreAddAssessor,
  centreSetAccess,
  centreReassign,
  centreDeleteUser,
  listAuditLog,
  listSupportRequests,
  updateSupportRequest,
  capabilityNationalStat,
  centreResetPassword,
  getExportRows,
  ConflictError,
} from "../db/index.js";
import { computeNationalDashboard } from "../lib/national.js";

export const centreRouter = asyncRouter();

// Everything here is a Centre capability. A Centre user has role='centre' and no state_id;
// RLS keeps drafts invisible and blocks any write to state-scoped score data.
centreRouter.use(requireRole("centre"));

centreRouter.get("/dashboard", async (req, res) => {
  const data = await getCentreDashboardData(req.auth!.ctx);
  if (!data) {
    res.status(503).json({ error: "No model version is published yet." });
    return;
  }
  const dashboard = computeNationalDashboard({
    rows: data.rows,
    totalStates: data.totalStates,
    statesWithAssessor: data.statesWithAssessor,
    submittedStates: data.submittedStates,
    excludedCapabilities: data.excludedCapabilities,
    openRequests: data.openRequests,
    newRequests: data.newRequests,
  });
  res.json({ modelVersion: data.modelVersion, ...dashboard });
});

// ── State assessors ─────────────────────────────────────────────────────────
centreRouter.get("/assessors", async (req, res) => {
  res.json({ assessors: await listAssessors(req.auth!.ctx) });
});

const assessorSchema = z.object({
  stateId: z.string().uuid(),
  name: z.string().trim().min(1),
  designation: z.string().trim().nullable().optional(),
  email: z.string().email(),
});

centreRouter.post("/assessors", async (req, res, next) => {
  const parsed = assessorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "State, name and a valid email are required." });
    return;
  }
  try {
    const r = await centreAddAssessor(req.auth!.ctx, {
      stateId: parsed.data.stateId,
      name: parsed.data.name,
      designation: parsed.data.designation ?? null,
      email: parsed.data.email,
    });
    res.status(201).json(r);
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});

centreRouter.patch("/assessors/:id", async (req, res, next) => {
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "active (boolean) is required." });
    return;
  }
  try {
    res.json(await centreSetAccess(req.auth!.ctx, req.params.id, parsed.data.active));
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});

centreRouter.post("/reassign", async (req, res, next) => {
  const parsed = assessorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "State, name and a valid email are required." });
    return;
  }
  try {
    res.json(
      await centreReassign(req.auth!.ctx, {
        stateId: parsed.data.stateId,
        name: parsed.data.name,
        designation: parsed.data.designation ?? null,
        email: parsed.data.email,
      }),
    );
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});

centreRouter.delete("/assessors/:id", async (req, res, next) => {
  try {
    await centreDeleteUser(req.auth!.ctx, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});

centreRouter.get("/audit", async (req, res) => {
  res.json({ audit: await listAuditLog(req.auth!.ctx) });
});

// Centre-initiated password reset (no self-serve flow). Returns a temp password for the
// Centre to hand over out-of-band.
centreRouter.post("/assessors/:id/reset-password", async (req, res) => {
  try {
    res.json(await centreResetPassword(req.auth!.ctx, req.params.id));
  } catch {
    res.status(404).json({ error: "Assessor not found." });
  }
});

// CSV export of every submitted assessment, one row per capability.
centreRouter.get("/export.csv", async (req, res) => {
  const rows = await getExportRows(req.auth!.ctx);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["state", "submitted_at", "assessor", "capability_id", "capability", "score", "evidence_system"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      esc(r.state_name),
      esc(r.submitted_at),
      esc(r.assessor_name),
      esc(r.capability_id),
      esc(r.capability_name),
      esc(r.value),
      esc(r.system_name),
    ].join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="dmm-submitted-assessments.csv"');
  res.send(lines.join("\n") + "\n");
});

// ── Requests ──────────────────────────────────────────────────────────────────
centreRouter.get("/requests", async (req, res) => {
  res.json({ requests: await listSupportRequests(req.auth!.ctx) });
});

centreRouter.patch("/requests/:id", async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["new", "in_progress", "closed"]).optional(),
      reply: z.string().nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request update." });
    return;
  }
  const ok = await updateSupportRequest(req.auth!.ctx, req.params.id, parsed.data);
  if (!ok) {
    res.status(404).json({ error: "Request not found." });
    return;
  }
  res.json({ ok: true });
});

centreRouter.get("/capability-stat", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name : "";
  if (!name) {
    res.status(400).json({ error: "name is required." });
    return;
  }
  res.json(await capabilityNationalStat(req.auth!.ctx, name));
});
