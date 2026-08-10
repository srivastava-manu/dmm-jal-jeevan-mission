import { Router } from "express";
import { listStates } from "../db/index.js";

export const statesRouter = Router();

// Public: the sign-in state picker and the "About the model" page need this without auth.
statesRouter.get("/", async (_req, res) => {
  res.json({ states: await listStates() });
});
