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

## Results, dashboard, compare & PDF (step 5)

Read-only screens for a submitted (or draft) assessment:

- **Results** `/assessment/:id/results` (screen 7) — executive summary. Every number comes
  from `server/src/lib/scoring.ts`, the single module that computes total / percent / band /
  per-layer index / strongest+weakest / top-four strengths / bottom-four focus / consistency
  flags (ties break by layer then capability position). The front end renders, computes
  nothing. Maxima derive from the capability count × the scale ceiling — never a hardcoded
  192/24.
- **Dashboard** `/assessment/:id/dashboard` (screen 8) — the 8×6 grid + a detail rail
  (measure, evidence, and the capability's value across submitted rounds).
- **Compare** `/assessment/:id/compare?to=<earlierId>` (screen 9) — matches capabilities by
  **name** across model versions; names in only one version are `notComparable` (added /
  retired) and are excluded from moves and from the improved/same/slipped counts. Default
  `to` = the most recent submitted round older than `:id`.

Endpoints (`server/src/routes/assessment-read.ts`, `requireAuth` only): `/results`,
`/history`, `/compare`. Visibility (same-state assessors + the Centre, submitted-only for the
Centre) is enforced by **RLS**, not the route — a cross-state read returns no rows → 404.
`npm run test:read` (part of `npm test`) proves this at the database layer.

**PDF is print CSS** — no library, no headless browser. `@page A4 portrait; margin: 12mm`,
the Export buttons call `window.print()`. Results prints as two pages: the summary, then the
labelled maturity grid, forced to page 2 with `break-before: page`.

To try cross-version compare locally: `npm run db:seed:demo` then
`npm run db:seed:compare-demo` (adds an earlier v2.0 with one renamed capability and a v2.0
round for Andhra Pradesh), then open a v2.1 assessment's Compare.

## About the model (public)

`/about` (README §10) is public — reachable without signing in. It is data-driven from the
public `GET /api/model` endpoint (current version's layers + capabilities + version history),
so the layer/capability counts and per-layer maximum are never hardcoded; the rating scale
and maturity bands are presentation constants. Signed-in assessors see the full nav; a
signed-out visitor sees a "Start the assessment" prompt. The assessor nav order is Results,
History, About.

## Centre (NJJM) surface (step 6)

Sign in as `centre@njjm.gov.in`. The Centre role has no `state_id`; RLS keeps drafts
invisible and blocks any write to state-scoped score data (`npm run test` proves both).

- **National dashboard** (`/dashboard`, screen 12) — KPIs, the 8×6 mean grid (click a cell
  for its distribution), per-layer national index, and a rail that expands each level to the
  states there; a chip opens that state's detail. Aggregation is `server/src/lib/national.ts`
  (reusing `scoring.ts`) over each state's LATEST submitted assessment; the "N of M" pill
  takes M from the `states` table. Capabilities from other model versions are excluded and
  counted.
- **State assessors** (`/centre/assessors`, screen 13) — table with an Active/Disabled access
  toggle and Add / Reassign. Reassignment creates the new assessor and moves the state's
  assessments to them (snapshot names on submitted rounds are untouched). A user with
  submitted assessments cannot be deleted (409 + FK RESTRICT). Every toggle/reassign is
  written to `audit_log`.
- **Requests** (`/centre/requests`, screen 14) — filter chips, request cards, and a rail to
  set status + reply. States raise requests from the Assess screen on a capability scored 0
  or 1; RLS scopes them both ways (`support_requests`).
- **State detail** (`/state/:assessmentId`, screen 15) — read-only grid. A draft id is
  refused at the database layer (404).

Optional demo data: `npm run db:seed:demo` seeds ~24 states of submissions so the dashboard,
assessors and (via the Assess screen) requests have content.

## Deploying to NIC

The app needs only Node ≥ 20 and a PostgreSQL endpoint. Nothing is bundled that assumes a
managed platform.

1. **Config** — set every variable from [`.env.example`](.env.example) in the environment.
   In production set `NODE_ENV=production` and `SESSION_COOKIE_SECURE=true` (cookies then
   require HTTPS). `DATABASE_URL` must point at a **non-superuser** role without BYPASSRLS
   (the app refuses to start otherwise); `ADMIN_DATABASE_URL` (owner/admin) is used only to
   run migrations.
2. **Schema** — `npm run db:setup` (creates/adjusts the app role + grants), then
   `npm run db:migrate` applies `migrations/*.sql` in order. These are the exact plain-SQL
   files NIC can review. `npm run db:seed:model` is folded into migration `004`.
3. **Build & run** — `npm run build -w server && npm run build -w client`, then
   `npm start -w server` behind the reverse proxy. Serve the built `client/dist` as static
   files. `trust proxy` is enabled so client IPs (used by the login rate limiter) are correct.
4. **Health** — `GET /api/health` returns `{ ok, db }` and 503 if the database is
   unreachable; point the load balancer's health check here.
5. **Logs** — one structured JSON line per request (`method`, `path`, `status`, `ms`). No
   bodies, query strings, scores, names or session data are ever logged.

### Postgres backup

```bash
# Nightly logical backup (schema + data), compressed:
pg_dump "$DATABASE_URL" -Fc -f dmm-$(date +%F).dump

# Restore into an empty database:
pg_restore -d "$ADMIN_DATABASE_URL" --clean --if-exists dmm-YYYY-MM-DD.dump
```

Migrations are forward-only and checked into the repo; a restore + `npm run db:migrate`
reproduces any schema state. Because each assessment stores its `model_version_id` and scores
are immutable snapshots, restoring never loses which model version an assessment was answered
against.

## Release hardening (step 7)

- **Systems as evidence** (screen 11) — a system carries its own name, districts and go-live;
  `scores.system_id` is the evidence link (FK `RESTRICT`). Editing a system is a factual
  correction that propagates to every assessment citing it, including submitted ones, and is
  written to `audit_log`. A system in use cannot be deleted (409 + the FK). Two entry points,
  one dialog: Home → "Manage systems", and a capability's evidence block → attach mode.
- **Model-version integrity** — bumping the model never mutates a submitted assessment;
  `test:model-integrity` publishes a new version and asserts old assessments still resolve
  against their own version in results, compare and the aggregate.
- **Access control** — `test:access` hits **every** route as same-state / other-state /
  Centre / anonymous and asserts the outcome for all four (108 checks). This is the
  authoritative access-control test.
- **Sessions & login** — sessions expire (`SESSION_TTL_HOURS`), logout deletes the server-side
  session, the Centre resets a state assessor's password (no self-serve flow), and login is
  rate-limited (10/IP/5 min).
- **Export** — Centre-only `GET /api/centre/export.csv`, one row per capability across all
  submitted assessments.
- **Ops** — DB-checking `/api/health`, structured request logs (method/path/status/ms only —
  no scores or PII), a completed `.env.example`, and the deploy + backup section above.
- **A11y / responsive** — visible keyboard focus rings; no horizontal scroll at 1366×768.

Run everything: `npm test` (19 tests) and `npm run typecheck`.

## Status

All 15 screens in `README.md` are built: the state assessor flow (screens 1–9), the public
About page (screen 10), the systems dialog (screen 11), and the Centre surface (screens
12–15). The production user-provisioning flow (invite / set-password for Centre-created
assessors) remains a deliberate stub — new assessors are created with no password until an
invite flow is added. Still not built: the
matrix re-assessment mode (screen 5), and the Centre's state-assessors and requests screens.
The production user-provisioning flow (Centre creates assessors; no self-signup) also lands
in a later step.
