import { describe, expect, it } from "vitest";
import {
  normalizeClayonOperationalSkillPreference,
  normalizeClayonRunnerAdapterConfig,
  CLAYON_OPERATIONAL_SKILL_KEY,
  resolveLegacyClayonDesiredSkillNames,
} from "@clayon/adapter-utils/server-utils";

const legacyConfig = {
  clayonSkillSync: {
    desiredSkills: [CLAYON_OPERATIONAL_SKILL_KEY],
  },
};

describe("paperclip_runner operational skill normalization", () => {
  it("applies full-auto native runner defaults at persistence boundaries", () => {
    expect(normalizeClayonRunnerAdapterConfig("paperclip_runner", {})).toEqual({
      provider: "codex",
      model: "gpt-5.6-sol",
      codexPermissionMode: "never",
      lifecycleMode: "per_turn",
    });
  });

  it("repairs an existing blank model without replacing an explicit model", () => {
    expect(normalizeClayonRunnerAdapterConfig("paperclip_runner", { model: "" }))
      .toMatchObject({ model: "gpt-5.6-sol" });
    expect(normalizeClayonRunnerAdapterConfig("paperclip_runner", { model: "gpt-5.5" }))
      .toMatchObject({ model: "gpt-5.5" });
  });

  it("does not replace a non-Codex provider model with the Codex default", () => {
    expect(normalizeClayonRunnerAdapterConfig("paperclip_runner", {
      provider: "claude_managed",
      model: "claude-sonnet-5",
    })).toMatchObject({
      provider: "claude_managed",
      model: "claude-sonnet-5",
    });
  });

  it("removes the legacy operational skill while preserving optional skills", () => {
    const normalized = normalizeClayonOperationalSkillPreference("paperclip_runner", {
      clayonSkillSync: {
        desiredSkills: [CLAYON_OPERATIONAL_SKILL_KEY, "company-1/reviewer"],
      },
    });

    expect(normalized).toEqual({
      clayonSkillSync: { desiredSkills: ["company-1/reviewer"] },
    });
  });

  it("restores the required operational skill through the legacy resolver after switching back", () => {
    const normalized = normalizeClayonOperationalSkillPreference("paperclip_runner", legacyConfig);
    expect(resolveLegacyClayonDesiredSkillNames(normalized, [{
      key: CLAYON_OPERATIONAL_SKILL_KEY,
      runtimeName: "clayon",
    }])).toEqual([CLAYON_OPERATIONAL_SKILL_KEY]);
  });

  it("does not change direct adapter preferences", () => {
    expect(normalizeClayonOperationalSkillPreference("codex_local", legacyConfig)).toBe(legacyConfig);
  });
});
