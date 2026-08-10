import pg from "pg";
import { ADMIN_DATABASE_URL } from "../config.js";

// Privileged pool used ONLY by migrations and the dev seed — never by the request path.
// It connects as the schema owner, which bypasses RLS (that is how migrations and seeds
// are allowed to write rows the app role could not).
export const adminPool = new pg.Pool({
  connectionString: ADMIN_DATABASE_URL,
  max: 4,
});
