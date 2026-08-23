# Deploying DMM on Replit (built-in Postgres)

The app runs as a **single service**: one Express process serves the built React client
*and* the `/api` on one port, backed by Replit's built-in (Neon) PostgreSQL. The repo is
already prepped (`.replit`, static-serving, SSL, `build`/`start`/`provision` scripts).

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

3. **Choose a `dmm_app` password** and build its URL from the injected owner URL — same host,
   database and `?sslmode=require`, but role `dmm_app`:
   ```
   postgresql://dmm_app:<APP_PASSWORD>@<PGHOST>/<PGDATABASE>?sslmode=require
   ```

4. **Provision the database** — in the Repl **Shell** (dev deps are present here), create the
   role, run migrations, and seed:
   ```bash
   npm install
   APP_DATABASE_URL="postgresql://dmm_app:<APP_PASSWORD>@<PGHOST>/<PGDATABASE>?sslmode=require" \
   PGSSL=true \
   SEED_CENTRE_PASSWORD="<centre-pw>" SEED_ASSESSOR_PASSWORD="<assessor-pw>" \
   npm run provision
   ```
   `provision` = `db:setup` (creates `dmm_app` from `APP_DATABASE_URL`, connecting as the
   owner `DATABASE_URL`) → `db:migrate` → `db:seed` → `db:seed:demo`. Drop the two
   `SEED_*` vars and the last seed step if you don't want demo data.

5. **Set Secrets** (Tools → Secrets) for the running app:
   | Key | Value |
   |---|---|
   | `APP_DATABASE_URL` | the `dmm_app` URL from step 3 |
   | `PGSSL` | `true` |
   | `SESSION_COOKIE_SECURE` | `true` |
   | `NODE_ENV` | `production` |
   `DATABASE_URL` is already provided by the DB integration — leave it (it's the owner /
   migrations connection). `.replit` also sets `NODE_ENV`/`PGSSL`/`SESSION_COOKIE_SECURE`,
   but Secrets are the source of truth for the deployment.

6. **Deploy.** Publish → **Autoscale**. Build runs `npm install && npm run build`; run runs
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
