import { z } from "zod";
import { DEFAULT_CONVEX_URL } from "./manifest.js";

export const SecretRefSchema = z.object({
  type: z.literal("secret_ref"),
  secretId: z.string().min(1),
  version: z.union([z.number().int().positive(), z.literal("latest")]).optional(),
});

export const PluginConfigSchema = z.object({
  convexUrl: z.url().default(DEFAULT_CONVEX_URL),
  readTokenRef: SecretRefSchema,
});

export const ChangeStatusSchema = z.enum(["added", "modified", "deleted", "renamed", "reverted"]);

export const ChangeSummarySchema = z.object({
  _id: z.string(),
  deviceId: z.string(),
  repositoryPath: z.string(),
  repositoryLabel: z.string(),
  changeKind: z.enum(["working-tree", "committed"]),
  commitMessage: z.string().optional(),
  filePath: z.string(),
  status: ChangeStatusSchema,
  additions: z.number(),
  deletions: z.number(),
  isPatchTruncated: z.boolean(),
  patchCharacters: z.number(),
  occurredAt: z.number(),
});

export const ChangeDetailSchema = ChangeSummarySchema.omit({ patchCharacters: true }).extend({
  patch: z.string(),
});

export const RepositorySchema = z.object({
  _id: z.string(),
  deviceId: z.string(),
  repositoryPath: z.string(),
  repositoryLabel: z.string(),
  state: z.enum(["watching", "quarantined", "recovered", "removed", "moved"]),
  message: z.string().optional(),
  updatedAt: z.number(),
});

export const ConvexQueryResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), value: z.unknown() }),
  z.object({ status: z.literal("error"), errorMessage: z.string() }),
]);

export const CodeChangesParamsSchema = z.object({
  companyId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
  repositoryPath: z.string().min(1).optional(),
});

export const ChangeParamsSchema = z.object({
  companyId: z.string().min(1),
  changeId: z.string().min(1),
});

export const RepositoriesParamsSchema = z.object({ companyId: z.string().min(1) });

export type ChangeSummary = z.infer<typeof ChangeSummarySchema>;
export type ChangeDetail = z.infer<typeof ChangeDetailSchema>;
export type Repository = z.infer<typeof RepositorySchema>;
