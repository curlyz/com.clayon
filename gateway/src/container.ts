import { Container } from "@inferdi/inferdi";

import { PaperclipRepository } from "./paperclipRepository";
import { createGatewayDatabase, type GatewayDatabase } from "./database";

/*
 * The InferDI composition root (operator 2026-10-16: "inferdi",
 * "container.ts"), the proven demo wiring
 * (com.agents/demos/workers/014-bounded-aggregates-api/src/container.ts).
 * Scoped factories give every request its own database and repository; the
 * scope's LIFO teardown finds Symbol.asyncDispose on the database and
 * destroys the pg pool — index.ts triggers it via waitUntil after the
 * response. Business code resolves services from the scope; it never grabs
 * a module singleton.
 */

// The kysely handle with a teardown hook the scope can find: dispose walks
// created instances and calls Symbol.asyncDispose when present.
export type DisposableDatabase = GatewayDatabase & {
  [Symbol.asyncDispose]: () => Promise<void>;
};

const createDisposableDatabase = (connectionString: string): DisposableDatabase => {
  const database = createGatewayDatabase(connectionString);
  return Object.assign(database, {
    [Symbol.asyncDispose]: async () => {
      await database.destroy();
    },
  });
};

export const root = new Container()
  .declareScopeInputs<{ env: PaperclipGatewayEnv }>()
  .registerFactory(
    "db",
    (c) => createDisposableDatabase(c.get("env").HYPERDRIVE.connectionString),
    ["env"],
    "scoped",
  )
  .registerFactory("repository", (c) => new PaperclipRepository(c.get("db")), ["db"], "scoped");

export function createAppScope(env: PaperclipGatewayEnv) {
  return root.createScope({ env });
}

export type Scope = ReturnType<typeof createAppScope>;
