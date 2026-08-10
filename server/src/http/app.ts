import express from "express";
import { attachSession } from "./session.js";
import { authRouter } from "../routes/auth.js";
import { statesRouter } from "../routes/states.js";
import { modelRouter } from "../routes/model.js";
import { centreRouter } from "../routes/centre.js";
import { assessmentsRouter } from "../routes/assessments.js";
import { assessmentReadRouter } from "../routes/assessment-read.js";
import { systemsRouter } from "../routes/systems.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  // Every request resolves its session (if any) before routing.
  app.use(attachSession);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/states", statesRouter);
  app.use("/api/model", modelRouter);
  app.use("/api/centre", centreRouter);
  // Read router first: results/history/compare are open to any authenticated user (RLS
  // scopes them), while the assessments router below gates writes to state_assessor.
  app.use("/api/assessments", assessmentReadRouter);
  app.use("/api/assessments", assessmentsRouter);
  app.use("/api/systems", systemsRouter);

  return app;
}
