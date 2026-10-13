import { definePlugin, runWorker } from "@clayon/plugin-sdk";
import { z } from "zod";
import {
  ChangeDetailSchema,
  ChangeParamsSchema,
  ChangeSummarySchema,
  CodeChangesParamsSchema,
  RepositoriesParamsSchema,
  RepositorySchema,
} from "./contracts.js";
import { queryConvex } from "./convex-query.js";

const PLUGIN_NAME = "cngkit-code-stream";
const DEFAULT_CHANGE_LIMIT = 100;

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup`);

    ctx.data.register("code-changes", async (params) => {
      const { companyId, limit, repositoryPath } = CodeChangesParamsSchema.parse(params);
      return queryConvex({
        ctx,
        companyId,
        functionPath: "ingest:listRecentChanges",
        args: { limit: limit ?? DEFAULT_CHANGE_LIMIT, repositoryPath },
        resultSchema: z.array(ChangeSummarySchema),
      });
    });

    ctx.data.register("repositories", async (params) => {
      const { companyId } = RepositoriesParamsSchema.parse(params);
      return queryConvex({
        ctx,
        companyId,
        functionPath: "ingest:listRepositories",
        args: {},
        resultSchema: z.array(RepositorySchema),
      });
    });

    ctx.data.register("change", async (params) => {
      const { companyId, changeId } = ChangeParamsSchema.parse(params);
      return queryConvex({
        ctx,
        companyId,
        functionPath: "ingest:getChange",
        args: { changeId },
        resultSchema: ChangeDetailSchema.nullable(),
      });
    });
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_NAME} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
