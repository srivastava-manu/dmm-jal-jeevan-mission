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

npm run db:setup      # create/adjust the dmm_app role + grants (idempotent)
npm run db:migrate    # apply migrations/001, 002 (plain SQL, tracked in schema_migrations)
npm run db:seed       # dev users: 1 centre + 2 assessors (AP, Bihar). Prints credentials.
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

Sign in with a seeded account (printed by `db:seed`). A `state_assessor` lands on
`/assess`; the `centre` lands on `/dashboard`. Both are step-1 landing surfaces — the real
screens come in later steps.

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

Per the build order in `README.md`, this is step 1 only. Not yet built: the `capabilities`
/ `model_versions` seed from `dmm-model.js`, the assessment flow, submission + the 7-day
lock, results/dashboard/compare, the Centre screens, user management, and requests. The
production user-provisioning flow (Centre creates assessors; no self-signup) also lands in
a later step — today's users come from the dev seed.
