import type { PluginContext } from "@clayon/plugin-sdk";
import type { z } from "zod";
import { ConvexQueryResponseSchema, PluginConfigSchema } from "./contracts.js";

const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

// Runs a public Convex query over the documented HTTP API (POST /api/query). The read token is
// resolved from the company secret at call time, travels only as a query argument, and is never
// returned to the UI or logged.
export async function queryConvex<Schema extends z.ZodType>(input: {
  ctx: PluginContext;
  companyId: string;
  functionPath: string;
  args: Record<string, unknown>;
  resultSchema: Schema;
}): Promise<z.infer<Schema>> {
  const parsedConfig = PluginConfigSchema.safeParse(await input.ctx.config.get(input.companyId));
  if (!parsedConfig.success) {
    throw new Error(
      "Code Changes is not configured: set the Convex URL and the read token secret in the plugin settings.",
    );
  }
  const config = parsedConfig.data;
  const readToken = await input.ctx.secrets.resolve(config.readTokenRef, {
    companyId: input.companyId,
    configPath: "readTokenRef",
  });

  const response = await input.ctx.http.fetch(new URL("/api/query", config.convexUrl).toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path: input.functionPath,
      args: { ...input.args, readToken },
      format: "json",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  });
  if (!response.ok) {
    throw new Error(`Convex answered ${response.status} for ${input.functionPath}.`);
  }

  const queryResponse = ConvexQueryResponseSchema.parse(await response.json());
  if (queryResponse.status === "error") {
    // Convex error text can echo server stack frames; log the function, not the text.
    input.ctx.logger.warn("Convex query failed", { functionPath: input.functionPath });
    throw new Error(`Convex rejected ${input.functionPath}. Check the read token.`);
  }
  return input.resultSchema.parse(queryResponse.value);
}
