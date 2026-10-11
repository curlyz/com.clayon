import { resolveClayonRunnerPiThinkingLevel } from "./clayon-runner-permissions.js";
import { describe, expect, it } from "vitest";

import {
  CLAYON_RUNNER_DEFAULT_MODELS,
  CLAYON_RUNNER_ACPX_PROFILES,
  clayonRunnerTransitionConfig,
  isClayonRunnerProvider,
  resolveClayonRunnerModel,
  resolveClayonRunnerPermissionMode,
  resolveClayonRunnerCursorMode,
} from "./clayon-runner-permissions.js";

describe("Clayon Runner permission defaults", () => {
  it("admits Pi with provider credentials while keeping Copilot pending", () => {
    expect(CLAYON_RUNNER_ACPX_PROFILES.find(profile => profile.value === "pi"))
      .toMatchObject({ qualified: true, credentialEnvironment: expect.arrayContaining(["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"]) });
    for (const agent of ["copilot"]) {
      expect(CLAYON_RUNNER_ACPX_PROFILES.find(profile => profile.value === agent)?.qualified).toBe(false);
    }
  });
  it("defaults Codex to the only qualified non-interactive mode", () => {
    expect(resolveClayonRunnerPermissionMode("codex", undefined)).toBe(
      "never",
    );
    expect(resolveClayonRunnerPermissionMode("codex", "on-request")).toBe("never");
    expect(resolveClayonRunnerPermissionMode("codex", "untrusted")).toBe("never");
  });

  it("defaults Claude and OpenCode to full auto", () => {
    expect(resolveClayonRunnerPermissionMode("opencode", undefined)).toBe(
      "allow",
    );
    expect(resolveClayonRunnerPermissionMode("acpx", undefined)).toBe(
      "approve-all",
    );
  });

  it.each(["approve-clayon", "approve-reads", "deny-all", "approve-all"])("preserves explicit Claude %s settings", (mode) => {
    expect(resolveClayonRunnerPermissionMode("acpx", mode)).toBe(mode);
  });

  it.each([
    ["claude_local", "acpxPermissionMode", "approve-all"],
    ["codex_local", "codexPermissionMode", "never"],
    ["opencode_local", "opencodePermissionMode", "allow"],
  ])("uses full auto when converting %s to the new runner", (adapter, key, value) => {
    expect(clayonRunnerTransitionConfig(adapter, undefined)).toMatchObject({ [key]: value });
  });

  it("recognizes only exact provider identifiers", () => {
    expect(isClayonRunnerProvider("codex")).toBe(true);
    expect(isClayonRunnerProvider("opencode")).toBe(true);
    expect(isClayonRunnerProvider("claude_managed")).toBe(true);
    expect(isClayonRunnerProvider("aws_agentcore")).toBe(true);
    expect(isClayonRunnerProvider("acpx")).toBe(true);
    expect(isClayonRunnerProvider("toString")).toBe(false);
    expect(isClayonRunnerProvider("__proto__")).toBe(false);
  });

  it("keeps managed provider permissions under the qualified profile", () => {
    expect(resolveClayonRunnerPermissionMode("claude_managed", "never"))
      .toBe("provider-managed");
    expect(resolveClayonRunnerPermissionMode("aws_agentcore", "approve-all"))
      .toBe("provider-managed");
  });

  it("uses the Codex default for missing or blank models", () => {
    expect(resolveClayonRunnerModel("codex", undefined)).toBe(
      CLAYON_RUNNER_DEFAULT_MODELS.codex,
    );
    expect(resolveClayonRunnerModel("codex", "   ")).toBe(
      CLAYON_RUNNER_DEFAULT_MODELS.codex,
    );
  });

  it("preserves an explicit Codex model", () => {
    expect(resolveClayonRunnerModel("codex", "gpt-5.5")).toBe("gpt-5.5");
    expect(resolveClayonRunnerModel("codex", "  gpt-5.5  ")).toBe("gpt-5.5");
  });
});


describe("Cursor session mode admission", () => {
  it.each([undefined, "agent", "plan", "ask"])("retains mode %s with an explicit Cursor default", mode => {
    expect(resolveClayonRunnerCursorMode("acpx", "cursor", mode)).toBe(mode ?? "agent");
  });
  it.each([null, "", "auto", "PLAN", true, {}, ["plan"]])("rejects invalid mode %j", mode => {
    expect(() => resolveClayonRunnerCursorMode("acpx", "cursor", mode)).toThrow("Cursor session mode");
  });
  it.each([["codex", "cursor"], ["acpx", "copilot"], ["acpx", "pi"], ["acpx", "claude"]])("rejects mode on %s/%s", (provider, agent) => {
    expect(resolveClayonRunnerCursorMode(provider, agent, undefined)).toBeUndefined();
    expect(() => resolveClayonRunnerCursorMode(provider, agent, "plan")).toThrow("only for Cursor");
  });
});

describe("Pi thinking configuration", () => {
  it.each([undefined, "off", "low", "high", "max"] as const)("persists exact level %s with low as the fresh-config default", value => {
    expect(resolveClayonRunnerPiThinkingLevel("acpx", "pi", value)).toBe(value ?? "low");
  });
  it.each(["medium", "minimal", "xhigh", "", null, 1])("rejects unsupported alias %s", value => {
    expect(() => resolveClayonRunnerPiThinkingLevel("acpx", "pi", value)).toThrow();
  });
  it("rejects foreign provider settings", () => {
    expect(() => resolveClayonRunnerPiThinkingLevel("codex", "pi", "low")).toThrow(/only/);
    expect(() => resolveClayonRunnerPiThinkingLevel("acpx", "cursor", "low")).toThrow(/only/);
    expect(resolveClayonRunnerPiThinkingLevel("codex", undefined, undefined)).toBeUndefined();
  });
});
