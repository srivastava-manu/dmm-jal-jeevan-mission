# Running on Replit

The **Start application** workflow builds the React client and the Express server, seeds the
development reviewer accounts from protected environment values, then serves the combined app on
port 5000:

```sh
npm run build && npm run db:seed && PORT=5000 npm run start
```

The project uses Replit's managed PostgreSQL database. `DATABASE_URL` is provided by the database
integration, while the protected `APP_DATABASE_URL` must use the non-privileged `dmm_app` role so
row-level security remains active. The checked-in migrations have been applied.

Open `/about` to view the public model page. `GET /api/health` reports database availability.

## Rules that must hold across environments

Local, Replit dev and Replit production share one codebase and more than one agent edits it.
These are not style preferences — breaking them corrupts data or publishes false statements to
the public About page. **Read `MODEL-VERSIONS.md` before touching model content or migrations.**

- **Schema and model content change ONLY through a checked-in numbered migration.** Never
  through the database pane, `psql`, or a console query — a row created by hand exists in one
  environment and nowhere else.
- **Never edit a migration that has already been applied.** `schema_migrations` records it by
  filename, so an edited file will not re-run and the environments silently disagree. Fix
  forward with a new number, taken *after* `git pull` so two agents don't both claim `009_`.
- **`model_versions.notes` is internal and never leaves the server. `public_notes` is written
  for state officials and is what `/about` lists; NULL hides the version.** Only set it for a
  version that changed what a score means, and never for `seed-compare-demo.ts`'s fabricated
  v2.0. See `MODEL-VERSIONS.md` for the rule and the wording guidance.
- **Set `published_at` explicitly at UTC midnight** in the migration. Left to `DEFAULT now()`
  it records when each database was migrated, so the same version shows a different date in
  every environment — presented publicly as a publication date.
- After pulling: `npm install --include=dev && npm run build`, then `npm run db:migrate` if a
  migration arrived.

The Start workflow requires protected `SEED_CENTRE_PASSWORD` and `SEED_ASSESSOR_PASSWORD` values.
It creates or refreshes the Centre account and two state-assessor accounts without printing their
passwords. Configure those values as Replit Secrets before starting the application; the workflow
fails instead of starting without reviewer accounts if either value is absent.