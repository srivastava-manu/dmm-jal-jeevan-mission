# Secrets and configuration across environments

Nothing secret is ever committed. Every environment supplies its own values, and the code
reads them only from the environment (`server/src/config.ts`). The repo contains exactly one
configuration file — [`.env.example`](.env.example) — and it holds **placeholders only**.

## The three environments

| | Where config lives | Database | Purpose |
|---|---|---|---|
| **Local** | `.env` at the repo root (gitignored) | local Postgres (`dmm_dev`) | development |
| **Replit dev** | Repl → Tools → **Secrets** | Replit's in-container dev DB (`helium`) | testing, minor changes |
| **Replit prod** | Deployment → **Secrets** | the deployment's own Postgres | real users |

**These are three separate databases.** Provisioning one does not touch the others: each needs
its own `npm run provision` (or migrate + seed) run once.

## What each environment needs

| Variable | Local | Replit dev | Replit prod | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | you set it (the `dmm_app` URL) | injected by Replit (owner) | injected by Replit (owner) | owner connection = migrations only on Replit |
| `APP_DATABASE_URL` | not needed | **required** | **required** | the unprivileged `dmm_app` role — this is what keeps RLS enforced |
| `NODE_ENV` | `development` | `production` | `production` | |
| `SESSION_COOKIE_SECURE` | `false` (plain http) | `true` | `true` | must be true over HTTPS |
| `PGSSL` | unset | unset (dev DB has no TLS) | `true` **only** if the URL lacks `sslmode=require` | |
| `SEED_CENTRE_PASSWORD` | dev value | dev value | **do not set** | seeding only; see below |
| `SEED_ASSESSOR_PASSWORD` | dev value | dev value | **do not set** | seeding only; see below |

## Rules

1. **Never commit a real value.** `.env` and `.env.*` are gitignored (`!.env.example` is the
   one exception). Verified: `.env` appears in no commit in this repo's history.
2. **Never reuse a password across environments.** The local `dmm_app` password, the Replit dev
   one and the production one must all differ. A leaked dev credential must not open production.
3. **Production credentials must be random**, not memorable: `openssl rand -base64 24`.
   `test` / `center` / `state` are fine for a throwaway dev database and nowhere else.
4. **Secrets belong in the Secrets pane, not the Shell.** `export FOO=…` in a Replit Shell
   disappears on restart and is invisible to the deployed app — which would then silently fall
   back to `DATABASE_URL` (the owner role) and **bypass row-level security**.
5. **Check the deployment's own Secrets.** Replit's workspace Secrets and a Deployment's Secrets
   are configured separately; confirm `APP_DATABASE_URL` is present on the deployment itself,
   not just in the workspace.

## Production hardening (before real users)

The seeded accounts are the real risk — not leaked keys.

- **Do not run `db:seed:demo` in production.** It invents 20 states' worth of submissions.
  Provision production with `npm run db:setup && npm run db:migrate` only.
- **Do not carry the demo logins into production.** `centre@njjm.gov.in` with a known password
  is a back door. Create the real Centre account, then disable or delete the seeded ones
  (`db:seed` is explicitly labelled dev-only in `server/src/scripts/seed.ts`).
- **Give each state assessor their own account** via the Centre's "Add a state assessor", and
  hand over the temporary password from "Reset password" out-of-band. There is no self-serve
  password email flow yet.

## Rotating a credential

The `dmm_app` password is the one most worth rotating.

```sql
ALTER ROLE dmm_app WITH PASSWORD '<new-random-password>';
```

Then update `APP_DATABASE_URL` in that environment's Secrets and restart. Nothing else stores
it — the browser never sees a database credential, and sessions are unaffected.

## If a secret is ever committed

Rotate it first (assume it is compromised the moment it lands on GitHub), then remove it from
history. Changing the file in a later commit is **not** enough — the value stays in history.

## Portability: the lockfile registry

Replit installs packages through an internal proxy and records **its** host in
`package-lock.json`'s `"resolved"` fields (`package-firewall.replit.local`). That host
resolves only inside Replit, so a lockfile carrying those URLs makes `npm install` fail
everywhere else with `ENOTFOUND` — local development, CI, and any future NIC deployment.

This is handled automatically: `postinstall` runs
[`scripts/normalize-lockfile.mjs`](scripts/normalize-lockfile.mjs) after **every** install, so
whichever environment installs, the recorded URLs are rewritten back to the public registry
before the file is ever committed. It does not change which registry npm fetches *from* —
Replit keeps using its proxy, which is what makes installs work there; only the recorded URL
is normalised. Rewriting the host is safe because the paths are identical to npm's and the
integrity hashes describe the tarball contents, not its location.

`npm run check:secrets` fails if private URLs slip through anyway (e.g. the lockfile was edited
without an install). To fix by hand:

```bash
node scripts/normalize-lockfile.mjs
```

## Optional features

| Variable | Default | Effect |
|---|---|---|
| `FEATURE_SUPPORT_REQUESTS` | off | Support requests (state raises, Centre answers) |

Disabled features are enforced at the **API**, not just hidden in the UI: their routes return
404 for every caller — state assessor, Centre and anonymous alike — so a disabled feature is
indistinguishable from one that was never built. The database tables and RLS policies stay in
place, so re-enabling is one environment variable with no migration.

`npm test` runs with the feature **on**, so its RLS policies stay continuously exercised while
the feature is dormant — otherwise they would rot silently and you would be trusting untested
isolation on the day you switch it on.
