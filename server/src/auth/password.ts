import { hash, verify } from "@node-rs/argon2";

// argon2id parameters — OWASP-recommended baseline. Tune per NIC hardware if needed.
const ARGON2_OPTS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTS);
}

export function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain, ARGON2_OPTS);
}
