import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CLAYON_RUNNER_COMPATIBILITY,
  ClayonRunnerCompatibilityError,
  assertClayonRunnerCompatibility,
} from "./compatibility.js";

describe("runner compatibility preflight", () => {
  it("keeps the compatibility manifest synchronized with the package version", () => {
    const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(CLAYON_RUNNER_COMPATIBILITY.packageVersion).toBe(manifest.version);
  });

  it("accepts the supported product/test/eval bundle", () => {
    expect(assertClayonRunnerCompatibility({
      consumer: "clayon-evals",
      components: {
        catalog: 1,
        protocol: 1,
        runnerClient: 1,
        controlPlaneAdapter: 1,
        testkit: 1,
      },
      evalCorpusVersion: 1,
      requiredOperationIds: ["get_task_context", "finish_task"],
      provider: {
        id: "codex-app-server",
        supportedOperationIds: ["get_task_context", "finish_task"],
      },
    })).toBe(CLAYON_RUNNER_COMPATIBILITY);
  });

  it("fails with stable component, corpus, catalog, and provider issues", () => {
    expect(() => assertClayonRunnerCompatibility({
      consumer: "incompatible-eval-bundle",
      components: { protocol: 2 },
      evalCorpusVersion: 2,
      requiredOperationIds: ["missing_operation", "finish_task"],
      provider: { id: "limited-provider", supportedOperationIds: [] },
    })).toThrow(ClayonRunnerCompatibilityError);

    try {
      assertClayonRunnerCompatibility({
        consumer: "incompatible-eval-bundle",
        components: { protocol: 2 },
        evalCorpusVersion: 2,
        requiredOperationIds: ["missing_operation", "finish_task"],
        provider: { id: "limited-provider", supportedOperationIds: [] },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ClayonRunnerCompatibilityError);
      expect((error as ClayonRunnerCompatibilityError).code).toBe("clayon_runner_incompatible");
      expect((error as ClayonRunnerCompatibilityError).issues.map((issue) => issue.code)).toEqual([
        "component_version_mismatch",
        "eval_corpus_version_unsupported",
        "catalog_operation_unknown",
        "provider_operation_unsupported",
      ]);
    }
  });

  it("requires explicit provider capabilities when operations are required", () => {
    expect(() => assertClayonRunnerCompatibility({
      consumer: "undeclared-provider",
      requiredOperationIds: ["finish_task"],
    })).toThrow(/provider_capabilities_missing/);
  });
});
