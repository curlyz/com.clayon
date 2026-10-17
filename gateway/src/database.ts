import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { agents } from "@clayon/db/schema/agents";
import type { Kyselify } from "drizzle-orm/kysely";

/*
 * drizzle owns the schema, kysely runs the queries (operator 2026-10-16:
 * "use drizzle + kysely"), the same bridge as com.curly/packages/backend
 * src/databases/. The drizzle pgTable in @clayon/db is the single schema
 * truth; Kyselify mirrors it into kysely's shape at type level with zero
 * codegen — the drizzle import is type-only, so the Worker bundle never
 * carries drizzle runtime code.
 *
 * `Kyselify<T>` always mirrors the physical snake_case SQL column name,
 * never the drizzle JS property key (drizzle-orm/table.d.ts MapColumnName,
 * dbColumnNames hardcoded true). CamelCasePlugin converts every result
 * row's keys to camelCase at runtime; CamelizeTable below is the type-level
 * mirror of that same transform, so this static type matches what queries
 * actually return.
 */

type CamelCaseString<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCaseString<Tail>>}`
  : S;

type CamelizeTable<Table> = {
  [Column in keyof Table as CamelCaseString<Column & string>]: Table[Column];
};

type AgentsTable = CamelizeTable<Kyselify<typeof agents>>;

export interface DatabaseShape {
  agents: AgentsTable;
}

export type GatewayDatabase = Kysely<DatabaseShape>;

export const createGatewayDatabase = (connectionString: string): GatewayDatabase =>
  new Kysely<DatabaseShape>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString, max: 1 }) }),
    plugins: [new CamelCasePlugin()],
  });
