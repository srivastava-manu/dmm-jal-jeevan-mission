---
name: Production database app role
description: Production database copies can leave the unprivileged app role without object grants.
---

When Replit provisions a production database from the development schema, an unprivileged
application role can be created after the schema objects already exist. Role membership and
object privileges are not safe to assume from the schema copy alone.

**Why:** The request-path role must remain separate from the provider-owned database role so
PostgreSQL row-level security is enforced, but a newly created role otherwise receives
database/schema access without the table and function privileges the app needs.

**How to apply:** Keep role setup idempotent and reapply only the explicit, least-privilege
grants required by the migrations. Do not solve this with broad grants on every table, because
some objects (such as sessions) are deliberately exposed only through controlled functions.
On Replit-managed production databases, validate an existing role's privilege attributes before
updating it; the provider owner may be unable to repeat `ALTER ROLE ... NOSUPERUSER` even when
the existing application role is already safe.