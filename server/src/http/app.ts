import path from "node:path";
import fs from "node:fs";
import express from "express";
import { REPO_ROOT } from "../config.js";
import { pool } from "../db/pool.js";
import { attachSession } from "./session.js";
import { authRouter } from "../routes/auth.js";
import { statesRouter } from "../routes/states.js";
import { modelRouter } from "../routes/model.js";
import { centreRouter } from "../routes/centre.js";
import { assessmentsRouter } from "../routes/assessments.js";
import { assessmentReadRouter } from "../routes/assessment-read.js";
import { systemsRouter } from "../routes/systems.js";
import { requestsRouter } from "../routes/requests.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true); // NIC runs behind a reverse proxy; needed for real client IPs
  app.use(express.json());

  // Structured request logs. Deliberately minimal: method, path (no query string), status and
  // duration. Never the body, query, scores, names or session — nothing personal or sensitive.
  app.use((req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const path = req.originalUrl.split("?")[0]; // captured before routers rewrite req.path
    res.on("finish", () => {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({ t: new Date().toISOString(), method, path, status: res.statusCode, ms: Date.now() - start }),
      );
    });
    next();
  });

  // Every request resolves its session (if any) before routing.
  app.use(attachSession);

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, db: "up" });
    } catch {
      res.status(503).json({ ok: false, db: "down" });
    }
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
  app.use("/api/requests", requestsRouter);

  // Production: serve the built client (client/dist) from the SAME origin as the API, so the
  // httpOnly session cookie works and relative /api calls resolve. In dev this directory does
  // not exist (Vite serves the client), so this is a no-op.
  const clientDist = path.join(REPO_ROOT, "client", "dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback: any non-/api GET returns index.html so client-side routes (/about,
    // /dashboard, /state/:id) survive a page refresh / deep link.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Safety net: any error passed to next() returns 500 instead of hanging the request. The
  // detail is logged, never sent to the client.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("Unhandled route error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error." });
  });

  return app;
}
