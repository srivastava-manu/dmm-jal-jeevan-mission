import { createApp } from "./http/app.js";
import { assertAppRoleIsUnprivileged } from "./db/pool.js";
import { PORT } from "./config.js";

// Safety net: a rejected promise from a route handler (Express 4 does not catch async
// errors) must never take the whole server down. Log and keep serving other requests.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught exception:", err);
});

async function main(): Promise<void> {
  // Fail fast if the app is (mis)configured to connect as a role that bypasses RLS.
  await assertAppRoleIsUnprivileged();

  const app = createApp();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`DMM API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start DMM API:", err);
  process.exit(1);
});
