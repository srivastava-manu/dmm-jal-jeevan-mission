import express from "express";
import { attachSession } from "./session.js";
import { authRouter } from "../routes/auth.js";
import { statesRouter } from "../routes/states.js";

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

  return app;
}
