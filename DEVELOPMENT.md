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

## The state assessment flow (step 3)

Sign in as a state assessor to reach `/home`:

- **Home / History** — saved assessments, the in-progress draft (with progress + discard),
  a maturity-over-time chart, and the systems card.
- **Start** (`/home/start`) — start blank or pre-filled from the last submitted assessment.
  Pre-fill writes **real `scores` rows** for the new assessment (and carries evidence
  forward); it does not merely display the old values.
- **Assess** (`/assessment/:id`) — the three-column screen: layer nav, capability cards
  with 0–4 scoring and autosave, the evidence block on scores of 3 and 4, and the score
  rail. A **score of 0 is a real answer** — "answered" is `value IS NOT NULL` everywhere,
  never a truthiness check.
- **Systems dialog** — capture the state's systems once, reused as evidence.

Counts are derived from the capability rows for the assessment's model version — nothing
hardcodes 48/6/24/192 (the only scale constant is the 0–4 ceiling).

To exercise pre-fill locally you need a prior submitted assessment for your state; the
optional `npm run db:seed:demo` seeds those (and gives you assessor logins such as
`raghavendra@apswsm.gov.in`). API and RLS for the write path are in
[`server/src/routes/assessments.ts`](server/src/routes/assessments.ts) and
[migration 005](migrations/005_assessment_flow.sql).

## Review, submit & the 7-day lock (step 4)

The last layer's "Review & submit →" opens `/assessment/:id/review`:

- Progress and the "still unanswered" list come from **one** server response
  (`GET /api/assessments/:id/review`) — `answered`/`total`/`canSubmit` are computed
  server-side by counting `value IS NOT NULL` against the capability count for the
  assessment's model version. The front end never recomputes them, so the unanswered list
  and the submit button can't disagree.
- Blocks: unanswered (blocking, `--danger-bg`), evidence gaps (advisory, `--warning-bg`),
  and "worth a second look" consistency flags (advisory).
- **Submit** (`POST /api/assessments/:id/submit`) re-checks completeness server-side, sets
  `status='submitted'`, `submitted_at=now()`, `locked_at=+7 days`, and **snapshots** the
  submitter's name + designation onto the row (reassigning the state never rewrites a past
  round's submitter).

The **7-day lock** is enforced in two independent places: the API returns a clear dated
error on score/evidence writes once `now() >= locked_at`, and the RLS policies refuse the
same write regardless of the API. `npm run test:lock` proves the RLS half by writing
directly with the API check bypassed (0 rows affected, value unchanged); `npm test` runs it
alongside the isolation test.

## What is intentionally NOT here yet

Built so far: steps 1–4 (auth/RLS/redirect, the national-dashboard slice, the assessment
flow, and review + submit + lock). Still not built: results / compare / PDF, the matrix
re-assessment mode, the Centre's state-assessors and requests screens, and dashboard cell
drill-down. The production user-provisioning flow (Centre creates assessors; no
self-signup) also lands in a later step.
