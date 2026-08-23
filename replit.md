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

The Start workflow requires protected `SEED_CENTRE_PASSWORD` and `SEED_ASSESSOR_PASSWORD` values.
It creates or refreshes the Centre account and two state-assessor accounts without printing their
passwords. Configure those values as Replit Secrets before starting the application; the workflow
fails instead of starting without reviewer accounts if either value is absent.