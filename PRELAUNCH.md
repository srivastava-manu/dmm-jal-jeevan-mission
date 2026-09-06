# Pre-launch checklist — production

Work through this once, in order, before real state officials sign in and submit real
assessments. Each item is a check with the command that proves it, not an instruction to be
careful.

The two rules underneath all of it: **no fabricated data may reach production**, and **RLS must
be provably active**, because it — not the API code — is what stops one state reading another's
rows.

---

## A. Deployment configuration

- [ ] **`APP_DATABASE_URL` is set as a deployment secret**, with the `dmm_app` role and its
      password. In production the app keeps this role and password but takes the host and
      database from Replit's injected `DATABASE_URL` (`server/src/config.ts`,
      `productionAppUrl`), so a secret shared from the workspace cannot point production at the
      development database. What must be right is the **role name and password**.

- [ ] **`APP_DATABASE_URL` is not missing.** If it is, the app falls back to `DATABASE_URL` —
      the table **owner** — and RLS is silently skipped for owners. See §D, which is the check
      that actually catches this.

- [ ] **`NODE_ENV=production` and `SESSION_COOKIE_SECURE=true`** (both already in `.replit`
      `[env]`). Secure cookies require HTTPS, which Replit deployments provide.

- [ ] **`FEATURE_SUPPORT_REQUESTS` is unset**, so support requests stay off for both roles.

- [ ] **`SEED_CENTRE_PASSWORD` and `SEED_ASSESSOR_PASSWORD` are absent** from the deployment —
      except during the one-time step in §C. The deployment build does not seed; leaving live
      credentials in secrets serves no purpose.

- [ ] **Nothing is committed.**
      ```bash
      npm run check:secrets
      ```

---

## B. Provision the production database — without demo data

**Do not run `npm run provision` against production.** It ends with `db:seed:demo`, which
creates an assessor for every state and **20 fabricated submitted assessments**. Those would
appear on the national dashboard as real maturity scores for real states.

- [ ] **Schema only:**
      ```bash
      npm install --include=dev && npm run db:setup && npm run db:migrate
      ```
      (The deployment build now runs these two on every publish; both are idempotent and
      destroy nothing — `db:setup` only wipes under `--reset`, which the deployment never
      passes.)

- [ ] **Confirm the database is empty of assessments and carries the model.** Against the
      production database:
      ```sql
      SELECT (SELECT count(*) FROM assessments)  AS assessments,   -- expect 0
             (SELECT count(*) FROM users)        AS users,         -- expect 0
             (SELECT count(*) FROM states)       AS states,        -- expect 36
             (SELECT count(*) FROM capabilities) AS capabilities;  -- expect 48
      ```

- [ ] **No fabricated model version is present.** `seed-compare-demo.ts` invents a v2.0 for the
      compare screen; it must never have been run here.
      ```sql
      SELECT version, public_notes IS NOT NULL AS listed_publicly FROM model_versions;
      ```
      Expect exactly `v2.1 | true`.

---

## C. The first Centre account

There is no self-signup and no script for creating a Centre user other than `db:seed`, which
also creates two demo assessors. So: seed once, then remove what you don't want.

- [ ] Set `SEED_CENTRE_PASSWORD` and `SEED_ASSESSOR_PASSWORD` temporarily, to strong unique
      values.
- [ ] Run **once**: `npm run db:seed`
- [ ] **Delete the two demo assessors** (`assessor.demo1@example.gov.in`,
      `assessor.demo2@example.gov.in`, in Sikkim and Tripura) through the Centre's *State
      assessors* screen, so the deletion is audited. They have no submitted assessments, so
      deletion is permitted.
- [ ] **Remove both `SEED_*` secrets** from the deployment.
- [ ] Confirm one user remains: `SELECT email, role FROM users;` → `centre@njjm.gov.in | centre`

> **Know this limit:** nobody can change their own password. The Centre resets *assessors'*
> passwords (`POST /api/centre/assessors/:id/reset-password`, audited, returns a temporary one
> to hand over out of band). The **Centre's own** password can only be changed by re-running
> `db:seed` with a new `SEED_CENTRE_PASSWORD`. Choose it accordingly, and record where it is
> kept.

---

## D. Prove isolation is actually on

This is the section not to skim. Every other guarantee in the app rests on it.

- [ ] **The app role is not the table owner.** RLS policies are skipped for the owner, and the
      startup guard does **not** catch this (it checks only `rolsuper` / `rolbypassrls`). Run
      against production:
      ```sql
      SELECT current_user AS app_connects_as,
             (SELECT tableowner FROM pg_tables WHERE tablename = 'users') AS table_owner;
      ```
      These **must differ**. `app_connects_as` should be `dmm_app`.

- [ ] **The role is unprivileged:**
      ```sql
      SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
        FROM pg_roles WHERE rolname = 'dmm_app';
      ```
      All four `false`.

- [ ] **The service started**, which means the startup guard passed:
      ```bash
      curl -s https://YOUR-APP/api/health     # {"ok":true,"db":"up"}
      ```

- [ ] **The full suite passes against a database with this schema:**
      ```bash
      npm test -w server                       # 31/31
      ```
      Covers cross-state isolation, the four-way access matrix, the 7-day lock in both API and
      RLS, Centre-never-sees-a-draft, and model-version integrity. Run it against dev, never
      production — it writes.

---

## E. Backups, with a restore you have actually performed

An untested backup is not a backup. Confirm what Replit's plan gives you for point-in-time
recovery, then keep your own copy outside it.

- [ ] **Take a dump:**
      ```bash
      pg_dump "$DATABASE_URL" -Fc -f dmm-$(date +%F).dump
      ```
- [ ] **Restore it into a scratch database** and confirm the row counts match the source. Not
      into production.
      ```bash
      pg_restore -d "$SCRATCH_DATABASE_URL" --clean --if-exists dmm-YYYY-MM-DD.dump
      ```
- [ ] **Decide who runs this and how often**, and where the dump is stored — somewhere that
      survives the Replit account.
- [ ] **Write down the recovery expectation** you are accepting: how much data loss, and how
      long to restore. States are told a submitted assessment is a permanent record.

---

## F. Smoke test over HTTPS

- [ ] Sign in as the Centre; the dashboard loads with **0 submitted** and no invented figures.
- [ ] Create one real state assessor; hand over the temporary password out of band.
- [ ] Sign in as that assessor, start an assessment, score a capability **0** — it must persist
      as 0, not read as unanswered.
- [ ] `/about` loads **signed out**, and Version history shows only `v2.1`.
- [ ] Support requests are gone for both roles:
      ```bash
      curl -s -o /dev/null -w '%{http_code}\n' https://YOUR-APP/api/centre/requests   # 404
      ```
- [ ] The session cookie is `Secure`, `HttpOnly`, `SameSite=Lax` (browser dev tools →
      Application → Cookies).
- [ ] A second assessor in a different state cannot see the first state's assessment.

---

## G. Accepted limits — record these as decisions, not oversights

- **No self-service password reset.** Centre-mediated only; the Centre's own password changes
  only via re-seeding.
- **Support requests are built but disabled.** Endpoints 404; the table and its RLS policies
  remain, so enabling it later is one environment variable.
- **Durability is the provider's.** Until §E is in place with your own off-platform copy, the
  answer to "can we recover a lost submission?" is whatever Replit's plan provides.
- **NIC, data localisation and Parichay are deferred**, per the current scope.

## Known gap worth closing

The startup guard (`server/src/db/pool.ts`, `assertAppRoleIsUnprivileged`) rejects superuser and
`BYPASSRLS` roles but **not the table owner** — the one case where RLS is skipped without any
privileged attribute being set. §D catches it by hand; extending the guard to refuse to start
when `current_user` owns the tables would make it impossible to deploy the misconfiguration at
all.
