import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../http/require-auth.js";
import { listSystems, createSystem } from "../db/index.js";

export const systemsRouter = Router();

systemsRouter.use(requireRole("state_assessor"));

systemsRouter.get("/", async (req, res) => {
  res.json({ systems: await listSystems(req.auth!.ctx) });
});

const systemSchema = z.object({
  name: z.string().trim().min(1),
  districts_live: z.number().int().min(0).nullable().optional(),
  go_live: z.string().nullable().optional(), // YYYY-MM-DD or null
});

systemsRouter.post("/", async (req, res) => {
  const parsed = systemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A system name is required." });
    return;
  }
  const system = await createSystem(req.auth!.ctx, {
    name: parsed.data.name,
    districts_live: parsed.data.districts_live ?? null,
    go_live: parsed.data.go_live ?? null,
  });
  res.status(201).json({ system });
});
