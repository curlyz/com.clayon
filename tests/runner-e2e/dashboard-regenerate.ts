import path from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { runnerMatrix } from "./catalog.js";
import { renderRunnerE2EDashboard } from "./dashboard.js";
import {
  buildRunnerCampaign,
  canonicalExecutionId,
  upgradeRunnerResult,
} from "./history.js";
import type {
  RunnerE2ECampaign,
  RunnerE2EHistoryIndex,
} from "./types.js";

const historyLlmUsageSchema = z.object({
  runCount: z.number(),
  runsWithTokenUsage: z.number(),
  runsWithReportedCost: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cachedInputTokens: z.number(),
  totalTokens: z.number(),
  reportedCostUsd: z.number(),
  costStatus: z.enum(["reported", "partial", "unpriced", "unavailable"]),
});

const historyRuntimeUsageSchema = z.object({
  provider: z.enum(["local", "daytona"]),
  agentRunDurationMs: z.number(),
  leaseDurationMs: z.number().nullable(),
  leaseCount: z.number(),
  cpuCores: z.number().optional(),
  memoryGiB: z.number().optional(),
  diskGiB: z.number().optional(),
  estimatedListCostUsd: z.number().optional(),
  costStatus: z.enum(["estimated", "unavailable", "not_metered"]),
  costSource: z.enum([
    "daytona_public_list_price",
    "provider_cost_unavailable",
    "local_not_metered",
  ]),
  pricingAsOf: z.string().optional(),
  pricingUrl: z.string().optional(),
});

const historyAssistantUsageSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  model: z.string(),
  observedModels: z.array(z.string()),
  requests: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cachedInputTokens: z.number(),
  estimatedCostUsd: z.number(),
  pricingAsOf: z.string(),
  pricingUrl: z.string(),
});

const historyResultBillingSchema = z.object({
  assistant: historyAssistantUsageSchema.optional(),
  llm: historyLlmUsageSchema,
  runtime: historyRuntimeUsageSchema,
  reportedCostUsd: z.number(),
  estimatedRuntimeCostUsd: z.number(),
  judge: z
    .object({
      inputTokens: z.number().nullable(),
      outputTokens: z.number().nullable(),
      estimatedCostUsd: z.number().nullable(),
      reservedCostUsd: z.number(),
    })
    .optional(),
  observedAndEstimatedCostUsd: z.number().nullable(),
  complete: z.boolean(),
});

const historyAggregateBillingSchema = z.object({
  assistant: z
    .object({
      requests: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      cachedInputTokens: z.number(),
      estimatedCostUsd: z.number(),
    })
    .optional(),
  judge: z
    .object({
      attempts: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      estimatedCostUsd: z.number().nullable(),
      reservedCostUsd: z.number(),
      attemptsWithUnknownUsage: z.number(),
    })
    .optional(),
  testCount: z.number(),
  agentRunDurationMs: z.number(),
  leaseDurationMs: z.number(),
  llm: historyLlmUsageSchema,
  reportedLlmCostUsd: z.number(),
  estimatedRuntimeCostUsd: z.number(),
  observedAndEstimatedCostUsd: z.number().nullable(),
  testsWithCompleteBilling: z.number(),
});

const historySuiteSummarySchema = z.object({
  suiteId: z.string(),
  suiteDefinitionHash: z.string(),
  expected: z.number(),
  selected: z.number(),
  executed: z.number(),
  passed: z.number(),
  failed: z.number(),
  incomplete: z.number().optional(),
  retries: z.number(),
  cleanupPassed: z.boolean(),
  complete: z.boolean(),
  durationMs: z.number(),
  billing: historyAggregateBillingSchema,
});

const historyExecutionSchema = z.object({
  executionId: z.string(),
  suiteId: z.string(),
  profileId: z.string(),
  environmentId: z.enum(["local", "daytona"]),
  caseId: z.string(),
  provider: z.string(),
  model: z.string(),
  status: z.enum(["passed", "failed", "incomplete"]),
  durationMs: z.number(),
  attempt: z.number(),
  cleanup: z.enum(["not_started", "passed", "failed"]),
  billing: historyResultBillingSchema,
});

const historyCampaignSchema = z.object({
  campaignId: z.string(),
  generatedAt: z.string(),
  source: z.object({
    sha: z.string().nullable(),
    ref: z.string().nullable(),
    workflowRunUrl: z.string().nullable(),
    eventName: z.string().nullable(),
  }),
  complete: z.boolean(),
  selected: z.number(),
  executed: z.number(),
  passed: z.number(),
  failed: z.number(),
  incomplete: z.number().optional(),
  retries: z.number(),
  cleanupPassed: z.boolean(),
  publicUrl: z.string(),
  billing: historyAggregateBillingSchema,
  suites: z.array(historySuiteSummarySchema),
  executions: z.array(historyExecutionSchema),
});

const runnerE2EHistoryIndexSchema = z.object({
  schema: z.literal("clayon.runner-e2e.history/v1"),
  updatedAt: z.string(),
  latestCampaignId: z.string().nullable(),
  latestGreenCampaignId: z.string().nullable(),
  latestBySuite: z.record(z.string(), z.string()),
  latestGreenBySuite: z.record(z.string(), z.string()),
  campaigns: z.array(historyCampaignSchema),
});

const publishedResultSchema = z.looseObject({
  schema: z.enum(["clayon.runner-e2e.result/v1", "clayon.runner-e2e.result/v2"]),
  executionId: z.string(),
  attempt: z.number(),
  status: z.enum(["passed", "failed"]),
  profileId: z.string(),
  environmentId: z.enum(["local", "daytona"]),
  caseId: z.string(),
  provider: z.string(),
  model: z.string(),
  runtimeMode: z.enum(["legacy", "native"]),
  startedAt: z.string(),
  finishedAt: z.string(),
  durationMs: z.number(),
  cleanup: z.enum(["not_started", "passed", "failed"]),
  evidenceValid: z.boolean().optional(),
  evidenceErrors: z.array(z.string()).optional(),
});

const publishedCampaignSchema = z.object({
  schema: z.string().optional(),
  campaignId: z.string().optional(),
  source: z
    .object({
      sha: z.string().nullable(),
      ref: z.string().nullable(),
      workflowRunUrl: z.string().nullable(),
      eventName: z.string().nullable(),
    })
    .optional(),
  generatedAt: z.string(),
  expected: z.array(z.string()),
  results: z.array(publishedResultSchema),
});

async function relativeFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true }).catch(
    () => [],
  );
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory())
      files.push(...(await relativeFiles(root, absolute)));
    if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return files;
}

async function readOptionalHistory(
  file: string,
): Promise<RunnerE2EHistoryIndex | undefined> {
  return readFile(file, "utf8")
    .then((value) => runnerE2EHistoryIndexSchema.safeParse(JSON.parse(value)))
    .then((value) => (value.success ? value.data : undefined))
    .catch((error: unknown) => {
      process.stderr.write(
        `[runner-e2e] Skipping unreadable history file ${file}: ${String(error)}\n`,
      );
      return undefined;
    });
}

export interface RegenerateRunnerDashboardInput {
  bundle: string;
  historyFile?: string | null;
  outputDirectory?: string;
  evidenceHrefPrefix?: string;
  publicSummaryImageHref?: string;
}

export async function regenerateRunnerDashboard(
  input: RegenerateRunnerDashboardInput,
) {
  const bundle = path.resolve(input.bundle);
  const outputDirectory = path.resolve(input.outputDirectory ?? bundle);
  const evidenceHrefPrefix = input.evidenceHrefPrefix?.replace(
    /^\/+|\/+$/g,
    "",
  );
  if (
    evidenceHrefPrefix &&
    (evidenceHrefPrefix.includes("\\") ||
      evidenceHrefPrefix
        .split("/")
        .some((segment) => !segment || segment === "." || segment === ".."))
  ) {
    throw new Error("evidenceHrefPrefix must be a safe relative URL path");
  }
  const publishedBundle = publishedCampaignSchema.safeParse(
    JSON.parse(
      await readFile(path.join(bundle, "normalized-results.json"), "utf8"),
    ),
  );
  if (!publishedBundle.success) {
    throw new Error("Published bundle has an invalid normalized-results.json");
  }
  const normalized = publishedBundle.data;

  const results = normalized.results.map(upgradeRunnerResult);
  const expected = normalized.expected.map(canonicalExecutionId);
  const campaign: RunnerE2ECampaign = buildRunnerCampaign({
    campaignId:
      normalized.campaignId ??
      `legacy-${normalized.generatedAt.replace(/[:.]/g, "-")}`,
    generatedAt: normalized.generatedAt,
    expected,
    results,
  });
  // A rendering refresh must not inherit the renderer's checkout or CI event.
  const retainedSource = results.find((result) =>
    result.source?.sha || result.source?.ref || result.source?.workflowRunUrl,
  )?.source;
  campaign.source = normalized.source ?? {
    sha: retainedSource?.sha ?? null,
    ref: retainedSource?.ref ?? null,
    workflowRunUrl: retainedSource?.workflowRunUrl ?? null,
    eventName: null,
  };
  const history =
    input.historyFile === null
      ? undefined
      : await readOptionalHistory(
          input.historyFile ?? path.join(bundle, "history.json"),
        );
  const entries = await Promise.all(
    normalized.results.map(async (publishedResult, index) => {
      const result = results[index]!;
      const originalExecutionId = publishedResult.executionId;
      const evidenceIds = [
        originalExecutionId,
        ...(originalExecutionId.startsWith("core-compatibility.")
          ? [originalExecutionId.slice("core-compatibility.".length)]
          : []),
      ];
      let evidenceBaseHref = "";
      let evidenceFiles: string[] = [];
      for (const evidenceId of evidenceIds) {
        const candidate = [
          "evidence",
          evidenceId,
          `attempt-${result.attempt}`,
        ].join("/");
        const files = await relativeFiles(
          path.join(bundle, ...candidate.split("/")),
        );
        if (files.length === 0) continue;
        evidenceBaseHref = [evidenceHrefPrefix, candidate]
          .filter(Boolean)
          .join("/");
        evidenceFiles = files;
        break;
      }
      return {
        result,
        valid:
          result.status === "passed" && result.cleanup === "passed" &&
          publishedResult.evidenceValid !== false,
        errors: publishedResult.evidenceErrors ?? [],
        evidenceBaseHref,
        evidenceFiles,
      };
    }),
  );
  const dashboard = renderRunnerE2EDashboard({
    title: "Runner Full-Stack E2E",
    generatedAt: normalized.generatedAt,
    expected,
    catalog: runnerMatrix,
    entries,
    campaign,
    history,
    publicSummaryImageHref: input.publicSummaryImageHref,
  });
  const upgraded = {
    ...campaign,
    results: campaign.results.map((result, index) => ({
      ...result,
      evidenceValid:
        normalized.results[index]?.evidenceValid ??
        (result.status === "passed" && result.cleanup === "passed"),
      evidenceErrors: normalized.results[index]?.evidenceErrors ?? [],
    })),
  };
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "index.html"), dashboard, "utf8"),
    writeFile(path.join(outputDirectory, "dashboard.html"), dashboard, "utf8"),
    writeFile(
      path.join(outputDirectory, "normalized-results.json"),
      `${JSON.stringify(upgraded, null, 2)}\n`,
      "utf8",
    ),
  ]);
  process.stdout.write(
    `Regenerated dashboard from ${normalized.results.length} retained result(s) in ${outputDirectory}\n`,
  );
}

async function main() {
  const arguments_ = process.argv
    .slice(2)
    .filter((argument) => argument !== "--");
  const bundleArgument = arguments_.find(
    (argument) => !argument.startsWith("--"),
  );
  if (!bundleArgument) {
    throw new Error(
      "Usage: bun run test:e2e:runner:dashboard -- <published-bundle-directory> [--history <history.json>]",
    );
  }
  const historyIndex = arguments_.indexOf("--history");
  const historyFile =
    historyIndex >= 0 ? arguments_[historyIndex + 1] : undefined;
  if (historyIndex >= 0 && !historyFile)
    throw new Error("--history requires a path");
  await regenerateRunnerDashboard({ bundle: bundleArgument, historyFile });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  await main().catch((error: unknown) => {
    const text = String(error).replace(/^Error:\s*/, "");
    process.stderr.write(`${text}\n`);
    process.exitCode = 1;
  });
}
