import { contract } from "@clayon/openapi";
import { implement, ORPCError } from "@orpc/server";

import type { Scope } from "./container";

/*
 * The whole rung-1 API surface: procedures implementing the GENERATED
 * contract (packages/openapi/openapi.yaml is the source of truth, recipe
 * moe:orpc/recipe-openapi-first-heygen). Procedures resolve the
 * request-scoped PaperclipRepository from the InferDI scope; container.ts owns
 * construction and teardown. Rung 1 is read-only: nothing to announce to an
 * invalidator.
 */

export type GatewayContext = {
  di: Scope;
};

const os = implement(contract).$context<GatewayContext>();

const generatedMeta = () => ({ generatedAt: new Date().toISOString() });

const health = os.health.handler(() => ({
  data: { status: "ok", service: "paperclip-api" },
  meta: generatedMeta(),
}));

const listAgents = os.listAgents.handler(async ({ input, context }) => ({
  data: await context.di.get("repository").readAgents({
    companyId: input.query.companyId,
    limit: input.query.limit ?? 20,
  }),
  meta: generatedMeta(),
}));

const readAgent = os.readAgent.handler(async ({ input, context }) => {
  const agent = await context.di.get("repository").readAgent(input.params.agentId);
  if (agent === null) throw new ORPCError("NOT_FOUND", { message: "No such agent." });
  return { data: agent, meta: generatedMeta() };
});

export const router = os.router({ health, listAgents, readAgent });
