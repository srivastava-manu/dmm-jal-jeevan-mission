import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Repo root is two levels up from server/src. Load the single root .env so every
// entrypoint (server, migrate, seed, tests) reads the same configuration.
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "..", "..");
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

// A base connection string must exist. On a managed host (e.g. Replit) this is the
// provider-injected owner URL; locally it is the dmm_app URL.
const BASE_DATABASE_URL = required("DATABASE_URL");

/**
 * Connection the API serves requests with: MUST be a non-owner, non-superuser role so RLS
 * is enforced. Prefer APP_DATABASE_URL when set — this lets a managed host keep its
 * auto-injected DATABASE_URL (the owner) for migrations while the app uses the unprivileged
 * dmm_app role. Locally, only DATABASE_URL is set, so both resolve to it.
 */
export const DATABASE_URL = optional("APP_DATABASE_URL", BASE_DATABASE_URL);

/** Privileged connection for migrations/seed only. Falls back to the base (owner) URL. */
export const ADMIN_DATABASE_URL = optional("ADMIN_DATABASE_URL", BASE_DATABASE_URL);

export const PORT = Number(optional("PORT", "3001"));

export const session = {
  ttlHours: Number(optional("SESSION_TTL_HOURS", "168")),
  cookieName: optional("SESSION_COOKIE_NAME", "dmm_sid"),
  cookieSecure: optional("SESSION_COOKIE_SECURE", "true") === "true",
  sameSite: optional("SESSION_COOKIE_SAMESITE", "lax") as "lax" | "strict" | "none",
};

export const seed = {
  centrePassword: process.env.SEED_CENTRE_PASSWORD ?? "",
  assessorPassword: process.env.SEED_ASSESSOR_PASSWORD ?? "",
};

export const isProduction = process.env.NODE_ENV === "production";
