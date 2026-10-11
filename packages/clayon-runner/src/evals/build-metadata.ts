import { createHash } from "node:crypto";

import { CLAYON_RUNNER_COMPATIBILITY } from "../compatibility.js";
import {
  PRP_PROTOCOL_MIN_VERSION,
  PRP_PROTOCOL_NAME,
  PRP_PROTOCOL_VERSION,
} from "../protocol/replay-contract.js";
import { canonicalCapabilitySemanticCatalog } from "../semantic-tools/catalog.js";

export const CLAYON_RUNNER_BUILD_METADATA_SCHEMA =
  "clayon-runner/build-metadata/v1" as const;
export const CLAYON_RUNNER_NATIVE_EXECUTION_SCHEMA =
  "clayon-runner/native-execution/v1" as const;
export const CLAYON_RUNNER_EVAL_INTEGRATION_SCHEMA =
  "clayon-runner/evals-integration/v1" as const;
export const CLAYON_RUNNERD_BUILD_METADATA_SCHEMA =
  "clayon-runner/runnerd-build-metadata/v1" as const;

export const CLAYON_RUNNER_SEMANTIC_CATALOG_SHA256 =
  `sha256:${createHash("sha256")
    .update(canonicalCapabilitySemanticCatalog())
    .digest("hex")}` as const;

/**
 * App-owned release metadata that Evals pins beside every native attempt.
 * Contract versions are independent from package semver so consumers can give
 * a precise mismatch instead of guessing from a package version.
 */
export const CLAYON_RUNNER_BUILD_METADATA = Object.freeze({
  schema: CLAYON_RUNNER_BUILD_METADATA_SCHEMA,
  package: Object.freeze({
    name: CLAYON_RUNNER_COMPATIBILITY.packageName,
    version: CLAYON_RUNNER_COMPATIBILITY.packageVersion,
  }),
  contracts: Object.freeze({
    evalIntegration: CLAYON_RUNNER_COMPATIBILITY.components.evalIntegration,
    nativeExecution: CLAYON_RUNNER_COMPATIBILITY.components.nativeExecution,
    runnerdArtifact: CLAYON_RUNNER_COMPATIBILITY.components.runnerdBinary,
    prp: PRP_PROTOCOL_VERSION,
    semanticCatalog: CLAYON_RUNNER_COMPATIBILITY.components.catalog,
    harnessDriver: CLAYON_RUNNER_COMPATIBILITY.components.harnessDriver,
    controlPlaneAdapter: CLAYON_RUNNER_COMPATIBILITY.components.controlPlaneAdapter,
    testkit: CLAYON_RUNNER_COMPATIBILITY.components.testkit,
  }),
  prp: Object.freeze({
    name: PRP_PROTOCOL_NAME,
    minimumVersion: PRP_PROTOCOL_MIN_VERSION,
    maximumVersion: PRP_PROTOCOL_VERSION,
  }),
  semanticCatalog: Object.freeze({
    version: CLAYON_RUNNER_COMPATIBILITY.components.catalog,
    sha256: CLAYON_RUNNER_SEMANTIC_CATALOG_SHA256,
  }),
  runnerd: Object.freeze({
    binaryName: "clayon-runnerd" as const,
    metadataSchema: CLAYON_RUNNERD_BUILD_METADATA_SCHEMA,
    digestAlgorithm: "sha256" as const,
  }),
});

export type ClayonRunnerBuildMetadata = typeof CLAYON_RUNNER_BUILD_METADATA;
