import { asyncRouter } from "../http/async-route.js";
import { z } from "zod";
import { requireRole } from "../http/require-auth.js";
import { listSystems, createSystem, editSystem, deleteSystem, ConflictError } from "../db/index.js";

export const systemsRouter = asyncRouter();
systemsRouter.use(requireRole("state_assessor"));

systemsRouter.get("/", async (req, res) => {
  res.json({ systems: await listSystems(req.auth!.ctx) });
});

// go_live may arrive as YYYY-MM (month input), YYYY-MM-DD, or null. Anything else is a
// client error (400) — never let it reach Postgres as an invalid date.
const systemSchema = z.object({
  name: z.string().trim().min(1),
  districts_live: z.number().int().min(0).nullable().optional(),
  go_live: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, "go_live must be YYYY-MM or YYYY-MM-DD")
    .nullable()
    .optional(),
});

function normalizeGoLive(v: string | null | undefined): string | null {
  if (!v) return null;
  return /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v; // YYYY-MM -> first of month
}

systemsRouter.post("/", async (req, res, next) => {
  const parsed = systemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the system name and go-live date." });
    return;
  }
  try {
    const system = await createSystem(req.auth!.ctx, {
      name: parsed.data.name,
      districts_live: parsed.data.districts_live ?? null,
      go_live: normalizeGoLive(parsed.data.go_live),
    });
    res.status(201).json({ system });
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});

systemsRouter.patch("/:id", async (req, res, next) => {
  const parsed = systemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the system name and go-live date." });
    return;
  }
  try {
    const system = await editSystem(req.auth!.ctx, req.params.id, {
      name: parsed.data.name,
      districts_live: parsed.data.districts_live ?? null,
      go_live: normalizeGoLive(parsed.data.go_live),
    });
    if (!system) {
      res.status(404).json({ error: "System not found." });
      return;
    }
    res.json({ system });
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});

systemsRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deleteSystem(req.auth!.ctx, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "System not found." });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      res.status(409).json({ error: e.message });
      return;
    }
    next(e);
  }
});
