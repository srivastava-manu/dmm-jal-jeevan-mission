import { Router } from "express";
import { z } from "zod";
import { getAuthProvider } from "../auth/provider.js";
import { startSession, endSession } from "../http/session.js";
import { requireAuth } from "../http/require-auth.js";
import type { Role } from "../db/rls.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** One app, one login, two roles — the landing surface is decided here by role. */
function redirectFor(role: Role): string {
  return role === "centre" ? "/dashboard" : "/assess";
}

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const identity = await getAuthProvider().login(parsed.data);
  if (!identity) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  await startSession(res, identity.userId);
  res.json({
    user: {
      name: identity.name,
      email: identity.email,
      role: identity.role,
      designation: identity.designation,
      stateId: identity.stateId,
    },
    redirect: redirectFor(identity.role),
  });
});

authRouter.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const a = req.auth!;
  res.json({
    user: {
      id: a.ctx.userId,
      name: a.profile.name,
      email: a.profile.email,
      role: a.ctx.role,
      designation: a.profile.designation,
      stateId: a.ctx.stateId,
    },
    redirect: redirectFor(a.ctx.role),
  });
});
