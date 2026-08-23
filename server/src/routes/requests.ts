import { asyncRouter } from "../http/async-route.js";
import { z } from "zod";
import { requireRole } from "../http/require-auth.js";
import { createSupportRequest, listSupportRequests } from "../db/index.js";

// State-side support requests. A state assessor raises one from a capability scored 0 or 1
// (business rule #10) and can read only their own state's (enforced by RLS).
export const requestsRouter = asyncRouter();
requestsRouter.use(requireRole("state_assessor"));

requestsRouter.get("/", async (req, res) => {
  res.json({ requests: await listSupportRequests(req.auth!.ctx) });
});

const createSchema = z.object({
  assessmentId: z.string().uuid().nullable().optional(),
  capabilityId: z.string().uuid(),
  scoreValue: z.number().int().min(0).max(4).nullable().optional(),
  message: z.string().trim().min(1),
});

requestsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A capability and a message are required." });
    return;
  }
  const r = await createSupportRequest(req.auth!.ctx, {
    assessmentId: parsed.data.assessmentId ?? null,
    capabilityId: parsed.data.capabilityId,
    scoreValue: parsed.data.scoreValue ?? null,
    message: parsed.data.message,
  });
  res.status(201).json(r);
});
