---
id: antl:clayon/docs/deploy/database
title: Database
summary: Embedded PostgreSQL vs Docker Postgres vs hosted
---

Clayon uses PostgreSQL via Drizzle ORM. Three ways to run it.

## 1. Embedded PostgreSQL (Default)

Zero config: no `DATABASE_URL` means the server starts an embedded PostgreSQL instance automatically.

```sh
bun run dev
```

First start:

1. Creates `~/.clayon/instances/default/db/` for storage
2. Ensures the `clayon` database exists
3. Runs migrations automatically
4. Starts serving requests

Data persists across restarts. To reset: `rm -rf ~/.clayon/instances/default/db`.

The Docker quickstart also uses embedded PostgreSQL by default.

## 2. Local PostgreSQL (Docker)

For a full PostgreSQL server locally:

```sh
docker compose -f docker/docker-compose.yml up -d db
```

Starts PostgreSQL 17 on `localhost:5432`. Set the connection string:

```sh
cp .env.example .env
# DATABASE_URL=postgres://clayon:clayon@localhost:5432/clayon
```

Push the schema:

```sh
DATABASE_URL=postgres://clayon:clayon@localhost:5432/clayon \
  bun run --cwd packages/db drizzle-kit push
```

## 3. Hosted PostgreSQL (Supabase)

For production, use hosted providers like [Supabase](https://supabase.com/).

1. Create a project at [database.new](https://database.new)
2. Copy the connection string from Project Settings > Database
3. Set `DATABASE_URL` in your `.env`

Use the **direct connection** (port 5432) for migrations and the **pooled connection** (port 6543) for the application.

Transaction-mode pooling: disable prepared statements via the environment — no source edits:

```sh
DATABASE_PREPARED_STATEMENTS=false
```

Related optional client tuning: `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_SECONDS`, `DATABASE_CONNECT_TIMEOUT_SECONDS`, `DATABASE_MAX_LIFETIME_SECONDS`, `DATABASE_APPLICATION_NAME`. Driver defaults apply when unset, except that idle pooled connections close after 60 seconds (`DATABASE_IDLE_TIMEOUT_SECONDS=0` keeps them open) and the pool reports `application_name=clayon`. See Connection pool settings `antl:clayon/docs/deploy/database#connection-pool-settings`.

## Connection Pool Settings

The server opens one postgres.js pool for its own queries, a second when `DATABASE_MIGRATION_URL` points elsewhere. All settings optional:

```text
[6]{Variable,Default,Effect}:
  `DATABASE_POOL_MAX`,`10` (driver),Maximum pooled connections.
  `DATABASE_IDLE_TIMEOUT_SECONDS`,`60`,Close a pooled connection after this much idle time. `0` keeps idle connections open forever (the driver default).
  `DATABASE_CONNECT_TIMEOUT_SECONDS`,`30` (driver),Give up on a connection attempt after this long.
  `DATABASE_MAX_LIFETIME_SECONDS`,"30–60 min, randomized (driver)",Recycle a pooled connection once it is this old.
  `DATABASE_APPLICATION_NAME`,`clayon`,"Value of `application_name` in `pg_stat_activity`, so you can find Clayon's backends: `SELECT * FROM pg_stat_activity WHERE application_name = 'clayon';`"
  `DATABASE_PREPARED_STATEMENTS`,`true` (driver),Set `false` behind a transaction-mode pooler (see above).
```

Pools end on shutdown (SIGINT/SIGTERM) and on startup failure after the pool opened, so restarts leave no idle backends. Size PostgreSQL `max_connections` for at least `DATABASE_POOL_MAX` per server process plus other clients.

## Switching Between Modes

- **Not set** — Embedded PostgreSQL
- **`postgres://...localhost...`** — Local Docker PostgreSQL
- **`postgres://...supabase.com...`** — Hosted Supabase

The Drizzle schema (`packages/db/src/schema/`) is the same regardless of mode.
