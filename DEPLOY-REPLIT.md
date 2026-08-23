# Deploying DMM on Replit (built-in Postgres)

The app runs as a **single service**: one Express process serves the built React client
*and* the `/api` on one port, backed by Replit's built-in PostgreSQL. The repo is
already prepped (`.replit`, static-serving, `build`/`start`/`provision` scripts).

## Why the two database roles matter
Row-level security is only enforced against a role that does **not own** the tables. Replit's
default DB role owns them, so the API must connect as a separate unprivileged role,
`dmm_app`. That is why you set **`APP_DATABASE_URL`** (the `dmm_app` role) while Replit's
auto-injected **`DATABASE_URL`** (the owner) is used only for migrations. If you skip this,
the app still boots but RLS is silently bypassed.

## Steps

1. **Import the repo.** Replit → Create → *Import from GitHub* →
   `srivastava-manu/dmm-jal-jeevan-mission` (authorize GitHub so the private repo is visible).

2. **Add PostgreSQL.** In the Repl: Tools → **Database** → create a PostgreSQL DB. This
   injects `DATABASE_URL` (owner) and `PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT`.

3. **Choose a `dmm_app` password** and build its URL from the injected owner URL, keeping the
   host, database and **the same `sslmode` the injected URL uses** — only the role and
   password change. In the Shell:
   ```bash
   echo "$DATABASE_URL" | sed -E 's#://[^:]+:[^@]+@#://dmm_app:<APP_PASSWORD>@#'
   ```
   The role name must be exactly `dmm_app` — the migrations grant to that literal name.

   **On SSL:** Replit's *development* database runs in-container (host `helium`) and speaks no
   TLS, so its URL carries `sslmode=disable` — keep it, and do **not** set `PGSSL`. A managed
   database (Neon, used by Replit production DBs) carries `sslmode=require`, which the app
   detects automatically. Only set `PGSSL=true` if you use a managed database whose URL omits
   `sslmode=require`.

4. **Provision the database** — in the Repl **Shell**, create the
   role, run migrations, and seed. With the secrets from step 5 already saved, the Shell
   inherits them:
   ```bash
   npm install --include=dev   # devDeps (tsx, tsc, vite) are skipped when NODE_ENV=production
   SEED_CENTRE_PASSWORD="<centre-pw>" SEED_ASSESSOR_PASSWORD="<assessor-pw>" npm run provision
   ```
   `provision` = `db:setup` (creates `dmm_app` from `APP_DATABASE_URL`, connecting as the
   owner `DATABASE_URL`) → `db:migrate` → `db:seed` → `db:seed:demo`. For a clean UAT database
   with no invented data, run `npm run db:setup && npm run db:migrate && npm run db:seed`
   instead — you still get the real 48-capability model and working logins.

5. **Set Secrets** (Tools → Secrets) for the running app:
   | Key | Value |
   |---|---|
   | `APP_DATABASE_URL` | the `dmm_app` URL from step 3 |
   | `SESSION_COOKIE_SECURE` | `true` |
   | `NODE_ENV` | `production` |
   | `PGSSL` | `true` — **only** for a managed DB whose URL lacks `sslmode=require` |

   `DATABASE_URL` is already provided by the DB integration — leave it (it's the owner /
   migrations connection). `.replit` also sets `NODE_ENV`/`SESSION_COOKIE_SECURE`, but
   Secrets are the source of truth for the deployment.

6. **Deploy.** Publish → **Autoscale**. Build runs `npm install --include=dev && npm run build`; run runs
   `npm run start` (`node server/dist/index.js`). The server listens on the injected `PORT`
   and serves everything on one origin.

## Verify
- Open the deployment URL → sign-in loads.
- Sign in as `centre@njjm.gov.in` → national dashboard renders with real numbers.
- Open `/about` while signed out → loads (no session, no state data).
- The startup guard passing proves the app connected as `dmm_app`; a Centre attempt to write
  scores is refused by RLS (see `server/src/test/centre-access.test.ts`).

## Re-deploying
Push to `master` and hit Redeploy. Migrations are **not** run automatically — re-run
`npm run db:migrate` in the Shell (with `DATABASE_URL` = owner) when you add a migration.

## Notes / limits
- Autoscale is fine because sessions live in Postgres, not memory.
- Login is rate-limited and `trust proxy` is on (correct client IPs behind Replit's proxy).
- This hosts a demo/UAT instance. The NIC production target is still plain PostgreSQL on NIC
  infrastructure (see `README.md`), reached by the same two-URL setup.
