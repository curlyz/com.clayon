# Database table whitepapers

Law: antl com.agents/docs/convention/stack.md § database discipline. A table without an
entry here does not get created; a migration that adds a table adds the entry
in the same change. (This project's docs folder is `doc/`, so the tables file
lives here — recorded deviation from the law's literal `docs/database/tables.md`.)

## agents (gateway read model)

First entry 2026-10-16, port rung 1
(doc/plans/2026-10-16-cloudflare-port-rung-1-gateway.md).

- **Why:** the gateway's first real read slice — the agent roster of one
  company. Not a new table: the gateway reads the legacy `agents` table
  whose single schema truth is the drizzle pgTable
  `packages/db/src/schema/agents.ts`, mirrored into kysely through
  `Kyselify` (`gateway/src/database.ts`).
- **Writer:** unchanged — the legacy Express server (and rung-1 local proof
  seeding through `gateway/scripts/seed.ts`). The gateway is read-only.
- **Readers:** gateway procedures `listAgents`, `readAgent`
  (`gateway/src/router.ts`) through `PostgresAgentsRepository`, selecting
  only the nine roster columns.
- **Hot queries and their plans:**
  - `SELECT … WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2`.
    Observed plan (2026-10-16, Homebrew Postgres 18.6, rung-1 local proof):
    `Index Scan using agents_company_id_uq on agents` + `Sort` (Sort Key:
    created_at DESC) + `Limit`. Index search on the company, never a seq
    scan; the sort is bounded by one company's agent count. If a company's
    roster grows past a few hundred rows, add
    `(company_id, created_at DESC)` to the legacy schema to drop the sort.
  - `SELECT … WHERE id = $1` — primary-key lookup, no plan entry needed
    beyond the PK.
- **Retention:** unchanged from the legacy table; the rung-1 local copy is
  throwaway (Homebrew `paperclip` database).
