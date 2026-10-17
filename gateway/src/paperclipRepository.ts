import type { GatewayDatabase } from "./database";

// The roster subset the contract's Agent schema promises. Field-for-field
// the wire shape of packages/openapi openapi.yaml Agent — no config, no
// secret, no lifecycle detail beyond the state string. The full agents row
// (packages/db schema) stays behind the repository; only these nine columns
// are selected, so nothing else can leak onto the wire. Timestamps surface
// as ISO strings because the contract's Agent schema says string.
export type AgentView = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  lifecycleState: string;
  createdAt: string;
  updatedAt: string;
};

// The selected database row before the wire mapping: same nine fields, but
// timestamptz reads back as Date.
type RosterRow = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  lifecycleState: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ReadAgentsParams = {
  companyId: string;
  limit: number;
};

const toAgentView = (row: RosterRow): AgentView => ({
  id: row.id,
  companyId: row.companyId,
  name: row.name,
  role: row.role,
  title: row.title,
  status: row.status,
  lifecycleState: row.lifecycleState,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// The one paperclip repository (B11: named after the project, no storage
// prefix, no twin interface — the class is its own type).
export class PaperclipRepository {
  private readonly database: GatewayDatabase;

  constructor(database: GatewayDatabase) {
    this.database = database;
  }

  async readAgents(params: ReadAgentsParams): Promise<AgentView[]> {
    const rows = await this.database
      .selectFrom("agents")
      .select([
        "id",
        "companyId",
        "name",
        "role",
        "title",
        "status",
        "lifecycleState",
        "createdAt",
        "updatedAt",
      ])
      .where("companyId", "=", params.companyId)
      .orderBy("createdAt", "desc")
      .limit(params.limit)
      .execute();
    return rows.map(toAgentView);
  }

  async readAgent(agentId: string): Promise<AgentView | null> {
    const rows = await this.database
      .selectFrom("agents")
      .select([
        "id",
        "companyId",
        "name",
        "role",
        "title",
        "status",
        "lifecycleState",
        "createdAt",
        "updatedAt",
      ])
      .where("id", "=", agentId)
      .limit(1)
      .execute();
    const row = rows[0];
    return row === undefined ? null : toAgentView(row);
  }
}
