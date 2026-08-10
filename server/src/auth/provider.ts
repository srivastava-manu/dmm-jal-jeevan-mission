import type { Role } from "../db/rls.js";
import { authLookupByEmail } from "../db/index.js";
import { verifyPassword } from "./password.js";

/** What a successful authentication yields, regardless of how it was performed. */
export interface AuthenticatedIdentity {
  userId: string;
  role: Role;
  stateId: string | null;
  name: string;
  email: string;
  designation: string | null;
}

/**
 * The seam that keeps auth swappable. Everything downstream (session creation, cookie,
 * RLS context) depends only on AuthenticatedIdentity, never on how it was obtained. To
 * move to Parichay/eSignet later, add a ParichayAuthProvider implementing this interface
 * and select it in getAuthProvider() — no route or data code changes.
 */
export interface AuthProvider {
  readonly kind: string;
  login(credentials: unknown): Promise<AuthenticatedIdentity | null>;
}

interface PasswordCredentials {
  email: string;
  password: string;
}

/** Self-hosted pilot auth: email + argon2-verified password. */
export class PasswordAuthProvider implements AuthProvider {
  readonly kind = "password";

  async login(credentials: unknown): Promise<AuthenticatedIdentity | null> {
    const { email, password } = credentials as PasswordCredentials;
    const user = await authLookupByEmail(email);

    // Verify a hash even when the user is missing/inactive, to keep timing uniform and
    // avoid leaking which emails exist.
    const hashToCheck =
      user?.active && user.password_hash
        ? user.password_hash
        : "$argon2id$v=19$m=19456,t=2,p=1$c29tZS1kdW1teS1zYWx0$0000000000000000000000000000000000000000000";

    let ok = false;
    try {
      ok = await verifyPassword(hashToCheck, password);
    } catch {
      ok = false;
    }

    if (!user || !user.active || !ok) return null;

    return {
      userId: user.id,
      role: user.role,
      stateId: user.state_id,
      name: user.name,
      email: user.email,
      designation: user.designation,
    };
  }
}

let provider: AuthProvider | null = null;

export function getAuthProvider(): AuthProvider {
  // Single place to switch providers (e.g. based on an AUTH_PROVIDER env var later).
  if (!provider) provider = new PasswordAuthProvider();
  return provider;
}
