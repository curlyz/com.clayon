import {
  NATIVE_RUNTIME_ASSET_SCHEMA,
  CLAYON_EXECUTION_PROMPT,
  CLAYON_EXECUTION_PROMPT_REVISION,
  canonicalNativeRuntimeContextDigest,
  nativeRuntimePromptDigest,
  type NativeRuntimeContextSnapshot,
} from "../../vendor/clayon-runner/index.js";

export function nativeRuntimeContextFixture(): NativeRuntimeContextSnapshot {
  const digest = "0".repeat(64);
  const context = {
    prompt: {
      revision: CLAYON_EXECUTION_PROMPT_REVISION,
      text: CLAYON_EXECUTION_PROMPT,
      digest: nativeRuntimePromptDigest(),
    },
    instructions: {
      entryPath: "AGENTS.md",
      bundle: {
        schema: NATIVE_RUNTIME_ASSET_SCHEMA,
        digest,
        manifestDigest: digest,
        rootPath: "/tmp/clayon-runtime-context-fixture",
        fileCount: 1,
        totalBytes: 1,
      },
    },
    skills: [],
    mcp: { assignmentSetId: "none", digest, bindingId: null },
  } satisfies Omit<NativeRuntimeContextSnapshot, "aggregateDigest">;
  return { ...context, aggregateDigest: canonicalNativeRuntimeContextDigest(context) };
}
