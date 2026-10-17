import { Pool } from "pg";

// Seeds the rung-1 roster against the migrated legacy schema (packages/db
// migrations applied by `pnpm --dir gateway run db:migrate`): one company,
// two agents, stable UUIDs so the proof curls in the plan and the AGENTS
// docs stay copy-paste runnable. Every other column keeps its default.
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const AGENT_ONE_ID = "22222222-2222-4222-8222-222222222222";
const AGENT_TWO_ID = "33333333-3333-4333-8333-333333333333";

const DEFAULT_URL = "postgres://paperclip:paperclip@127.0.0.1:5433/paperclip";
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? DEFAULT_URL, max: 1 });

type SeedAgentParams = {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
};

await pool.query("INSERT INTO companies (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [
  COMPANY_ID,
  "Paperclip Rung 1",
]);

const seedAgent = async (params: SeedAgentParams): Promise<void> => {
  await pool.query(
    `INSERT INTO agents (id, company_id, name, role, title, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [params.id, COMPANY_ID, params.name, params.role, params.title, params.status],
  );
};

await seedAgent({
  id: AGENT_ONE_ID,
  name: "Scout",
  role: "research",
  title: "Research Scout",
  status: "idle",
});
await seedAgent({ id: AGENT_TWO_ID, name: "Sentry", role: "review", title: null, status: "busy" });
await pool.end();
process.stdout.write(`seeded company ${COMPANY_ID} with 2 agents\n`);
