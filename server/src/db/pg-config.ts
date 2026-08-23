import type { PoolConfig } from "pg";

/**
 * Build a pg PoolConfig, enabling TLS when the connection needs it. Managed Postgres
 * (Replit/Neon, etc.) requires SSL and its URLs carry `sslmode=require`; `PGSSL=true` forces
 * it explicitly. Local (Homebrew) Postgres needs none, so SSL stays off there.
 */
export function poolConfig(connectionString: string, extra: Partial<PoolConfig> = {}): PoolConfig {
  const needsSsl = process.env.PGSSL === "true" || /sslmode=require/i.test(connectionString);
  return {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    ...extra,
  };
}
