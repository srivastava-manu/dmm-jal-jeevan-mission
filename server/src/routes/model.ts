import { Router } from "express";
import { getPublicModel } from "../db/index.js";

export const modelRouter = Router();

// Public: the "About the model" page is reachable without signing in.
modelRouter.get("/", async (_req, res) => {
  const model = await getPublicModel();
  if (!model) {
    res.status(503).json({ error: "No model version is published yet." });
    return;
  }
  res.json(model);
});
