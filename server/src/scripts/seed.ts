import { adminPool } from "../db/admin.js";
import { hashPassword } from "../auth/password.js";
import { seed as seedCfg } from "../config.js";

// Dev-only seed: one Centre user and two state assessors in DIFFERENT states, so the
// isolation test has something real to cross-check. Passwords come from protected environment
// variables — never hardcoded. Idempotent: re-running upserts the same three users.
//
// This is NOT the production provisioning flow. In production the Centre creates
// assessors (build step 7); there is no self-signup.

interface SeedUser {
  email: string;
  name: string;
  designation: string | null;
  role: "state_assessor" | "centre";
  stateName: string | null;
  password: string;
}

async function main(): Promise<void> {
  if (!seedCfg.centrePassword || !seedCfg.assessorPassword) {
    throw new Error(
      "Set SEED_CENTRE_PASSWORD and SEED_ASSESSOR_PASSWORD before seeding.",
    );
  }

  const users: SeedUser[] = [
    {
      email: "centre@njjm.gov.in",
      name: "National JJM Cell",
      designation: "Programme Coordinator",
      role: "centre",
      stateName: null,
      password: seedCfg.centrePassword,
    },
    // Two demo assessors in states OUTSIDE the njjm-24 national seed (see seed-model.ts),
    // so the step-1 auth/isolation demo never collides with the dashboard seed's
    // one-active-assessor-per-state rule.
    {
      email: "assessor.demo1@example.gov.in",
      name: "Demo Assessor One",
      designation: "State IT Officer",
      role: "state_assessor",
      stateName: "Sikkim",
      password: seedCfg.assessorPassword,
    },
    {
      email: "assessor.demo2@example.gov.in",
      name: "Demo Assessor Two",
      designation: "State IT Officer",
      role: "state_assessor",
      stateName: "Tripura",
      password: seedCfg.assessorPassword,
    },
  ];

  const client = await adminPool.connect();
  try {
    for (const u of users) {
      let stateId: string | null = null;
      if (u.stateName) {
        const s = await client.query<{ id: string }>(
          "SELECT id FROM states WHERE name = $1",
          [u.stateName],
        );
        if (!s.rows[0]) throw new Error(`Seed state not found: ${u.stateName}`);
        stateId = s.rows[0].id;
      }
      const passwordHash = await hashPassword(u.password);
      await client.query(
        `INSERT INTO users (email, name, designation, role, state_id, password_hash, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (lower(email)) DO UPDATE SET
           name = EXCLUDED.name,
           designation = EXCLUDED.designation,
           role = EXCLUDED.role,
           state_id = EXCLUDED.state_id,
           password_hash = EXCLUDED.password_hash,
           active = true`,
        [u.email, u.name, u.designation, u.role, stateId, passwordHash],
      );
      console.log(`Seeded ${u.role.padEnd(15)} ${u.email}${u.stateName ? `  (${u.stateName})` : ""}`);
    }
    console.log(
      "\nSeed complete. Demo sign-in passwords were read from " +
        "SEED_CENTRE_PASSWORD and SEED_ASSESSOR_PASSWORD.",
    );
  } finally {
    client.release();
    await adminPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
