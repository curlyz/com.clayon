import { createHash } from "node:crypto";

import type { ClayonJsonSchema } from "../catalog/semantic-action-types.js";
import type { ClayonSemanticToolDefinition } from "./types.js";

export const CLAYON_RUNNER_AUTHORIZED_TOOLS_SCHEMA =
  "clayon.runner.authorized-tools.v1" as const;

export interface ClayonRunnerAuthorizedTool {
  readonly operationId: string;
  readonly version: 1;
  readonly description: string;
  readonly inputSchema: ClayonJsonSchema;
  readonly responseSchema: ClayonJsonSchema;
}

export interface ClayonRunnerAuthorizedToolSet {
  readonly schema: typeof CLAYON_RUNNER_AUTHORIZED_TOOLS_SCHEMA;
  readonly schemaVersion: 1;
  readonly catalogDigest: string;
  readonly operations: readonly ClayonRunnerAuthorizedTool[];
}

export function createClayonRunnerAuthorizedToolSet(
  definitions: readonly ClayonSemanticToolDefinition[],
): ClayonRunnerAuthorizedToolSet {
  const names = new Set<string>();
  const operations = definitions
    .map((definition): ClayonRunnerAuthorizedTool => {
      if (definition.annotations.version !== 1 || names.has(definition.name)) {
        throw new Error("clayon_runner_authorized_tools_invalid");
      }
      names.add(definition.name);
      return {
        operationId: definition.name,
        version: 1,
        description: definition.description,
        inputSchema: definition.inputSchema,
        responseSchema: definition.outputSchema,
      };
    })
    .sort((left, right) =>
      left.operationId < right.operationId
        ? -1
        : left.operationId > right.operationId
          ? 1
          : 0,
    );
  return deepFreeze({
    schema: CLAYON_RUNNER_AUTHORIZED_TOOLS_SCHEMA,
    schemaVersion: 1,
    catalogDigest: digestOperations(operations),
    operations,
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function digestOperations(
  operations: readonly ClayonRunnerAuthorizedTool[],
): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJson(operations))
    .digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error("clayon_runner_authorized_tools_invalid");
    }
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
