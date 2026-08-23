# Running on Replit

The **Start application** workflow builds the React client and the Express server, then serves the
combined app on port 5000:

```sh
npm run build && PORT=5000 npm run start
```

The project uses Replit's managed PostgreSQL database. `DATABASE_URL` is provided by the database
integration, while the protected `APP_DATABASE_URL` must use the non-privileged `dmm_app` role so
row-level security remains active. The checked-in migrations have been applied.

Open `/about` to view the public model page. `GET /api/health` reports database availability.

No demo login accounts are seeded by default. To add the repository's development users, first set
protected `SEED_CENTRE_PASSWORD` and `SEED_ASSESSOR_PASSWORD` values, then run:

```sh
npm run db:seed
```