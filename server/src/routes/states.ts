import { asyncRouter } from "../http/async-route.js";
import { listStates } from "../db/index.js";

export const statesRouter = asyncRouter();

// Public: the sign-in state picker and the "About the model" page need this without auth.
statesRouter.get("/", async (_req, res) => {
  res.json({ states: await listStates() });
});
