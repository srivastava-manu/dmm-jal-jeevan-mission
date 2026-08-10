# DMM — developer setup (step 1)

This repo implements the app described in [`README.md`](README.md). This document covers
running it locally. **Step 1** delivers: `states` + `users` + `sessions` migrations,
session-based auth (argon2, httpOnly cookie, sessions in Postgres), the RLS
session-variable plumbing, role-based redirect after sign-in, and an automated test
proving one state's assessor cannot read another state's rows.

## Architecture (what's true already)

- **Monorepo**, npm workspaces: [`client/`](client) (React + Vite + TS),
  [`server/`](server) (Express + TS), [`migrations/`](migrations) (plain SQL).
- **The browser never connects to Postgres.** All data access is via the Express API.
- **All SQL lives in [`server/src/db/`](server/src/db).** Route handlers call scoped
  functions; they never write SQL. See [`server/src/db/index.ts`](server/src/db/index.ts).
- **Row-level security is the primary isolation guarantee.** Every request runs inside a
  transaction that sets `app.user_id` / `app.role` / `app.state_id`
  ([`server/src/db/rls.ts`](server/src/db/rls.ts)); policies filter on
  `current_setting(...)`. The API connects as the unprivileged role `dmm_app`, so RLS is
  enforced against it — a startup guard refuses to run if that role could bypass RLS.
- **Auth is swappable.** [`server/src/auth/provider.ts`](server/src/auth/provider.ts)
  defines an `AuthProvider` seam; a Parichay/eSignet provider drops in later with no
  changes to routes or data code.
- **All config from env.** Nothing secret is committed; see [`.env.example`](.env.example).

## Prerequisites

- Node ≥ 20 (developed on Node 25).
- PostgreSQL 17 running locally. On macOS via Homebrew:
  ```bash
  brew install postgresql@17
  brew services start postgresql@17
  export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
  ```

## One-time database creation

The app connects with a *non-superuser* role so RLS applies. Create the database once;
the role and grants are handled by `db:setup`.

```bash
createdb dmm_dev
```

Then copy the env template and set real values (the committed `.env` here holds local dev
values only):

```bash
cp .env.example .env   # then edit DATABASE_URL / ADMIN_DATABASE_URL / passwords
```

- `ADMIN_DATABASE_URL` — a privileged role (owner/superuser) used **only** for migrations
  and seeding. Locally this is your superuser, e.g. `postgresql://<you>@localhost:5432/dmm_dev`.
- `DATABASE_URL` — the unprivileged app role, e.g.
  `postgresql://dmm_app:<pw>@localhost:5432/dmm_dev`. The API uses only this.

## Install and bring up

```bash
npm install

npm run db:setup       # create/adjust the dmm_app role + grants (idempotent)
npm run db:migrate     # apply migrations/001–003 (plain SQL, tracked in schema_migrations)
npm run db:seed        # dev users: 1 centre + 2 demo assessors (Sikkim, Tripura)
npm run db:seed:model  # model v2.1 (48 capabilities) + 20 submitted assessments from the data files
```

Reset everything and re-seed:

```bash
npm run db:reset
```

## Run

Two terminals:

```bash
npm run dev:server    # API on http://localhost:3001
npm run dev:client    # app on http://localhost:5173  (proxies /api -> :3001)
```

Sign in with a seeded account (printed by `db:seed` / `db:seed:model`). A `state_assessor`
lands on `/assess` (still a placeholder); the `centre` lands on `/dashboard`, which is a
real, data-backed national dashboard once `db:seed:model` has run.

## The national dashboard (data slice)

`db:seed:model` loads the authoritative content from `dmm-model.js` and
`njjm-centre-data.js` into real rows: model v2.1 with its 48 capabilities, an assessor per
seeded state, and 20 **submitted** assessments (4 further states have an assessor but no
submission). Sign in as `centre@njjm.gov.in` to see:

- KPIs (national maturity, submitted count, weakest/strongest layer),
- the 8×6 mean-score grid coloured by rounded mean,
- the layer-wise national averages.

The two headline business rules are enforced by the **database**, not the UI: every Centre
query runs in the Centre's RLS context, so drafts are invisible and non-submitting states
are simply absent from the averages (never counted as zero). The dashboard API is
[`server/src/routes/centre.ts`](server/src/routes/centre.ts) →
[`getNationalCapabilityMeans`](server/src/db/index.ts).

Deferred to the real step 6: per-cell state distribution drill-down, the state-assessors
screen, requests, and PDF export.

## The isolation test (the step-1 proof)

```bash
npm run test:isolation
```

It runs against the **app** connection (`dmm_app`), so RLS is enforced exactly as in
production. It proves, among other things, that an unscoped `SELECT * FROM users` executed
as one state's assessor returns **only that assessor's own row** — the database engine, not
the application code, enforces the boundary. See
[`server/src/test/isolation.test.ts`](server/src/test/isolation.test.ts).

## Typecheck

```bash
npm run typecheck
```

## What is intentionally NOT here yet

Step 1 (auth/RLS/redirect) is complete, plus a vertical slice to make the national
dashboard real (schema for `model_versions`/`capabilities`/`assessments`/`scores`, the
model + submitted-assessment seed, and the dashboard read path). Still not built: the state
assessment flow (layer nav, scoring, autosave, evidence), the review + submit + 7-day-lock
*write* path, results / compare / PDF, the Centre's state-assessors and requests screens,
and dashboard cell drill-down. The production user-provisioning flow (Centre creates
assessors; no self-signup) also lands in a later step — today's users come from the seeds.
