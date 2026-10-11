// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  classifyShellRoute,
  getCompanyPathSegments,
} from "./shell-navigation";

describe("shell navigation", () => {
  it("classifies task detail independently from list routes", () => {
    expect(classifyShellRoute("/PAP/issues", "PAP").isTaskDetail).toBe(false);
    expect(classifyShellRoute("/PAP/issues/task-1", "PAP").isTaskDetail).toBe(true);
  });

  it("classifies the built-in contextual surfaces", () => {
    expect(classifyShellRoute("/PAP/company/settings/secrets", "PAP").builtInContextualSurface).toBe("settings");
    expect(classifyShellRoute("/PAP/company/export", "PAP").builtInContextualSurface).toBe("settings");
    expect(classifyShellRoute("/PAP/apps/connections", "PAP").builtInContextualSurface).toBe("apps");
    expect(classifyShellRoute("/PAP/tools/runtime", "PAP").builtInContextualSurface).toBe("apps");
    expect(classifyShellRoute("/PAP/agents/agent-1/instructions", "PAP").builtInContextualSurface).toBe("agent");
    expect(classifyShellRoute("/PAP/agents/agent-1/runs/run-1", "PAP").builtInContextualSurface).toBe("agent");
    expect(classifyShellRoute("/PAP/routines/routine-1/overview", "PAP").builtInContextualSurface).toBe("routine");
    expect(classifyShellRoute("/PAP/skills", "PAP").builtInContextualSurface).toBe("skills");
    expect(classifyShellRoute("/PAP/skills/studio/skill-1", "PAP").builtInContextualSurface).toBe("skills");
  });

  it("keeps Agent and Routine collection routes in the global shell", () => {
    for (const pathname of [
      "/PAP/agents",
      "/PAP/agents/all",
      "/PAP/agents/active",
      "/PAP/agents/paused",
      "/PAP/agents/error",
      "/PAP/agents/builtin",
      "/PAP/agents/new",
      "/PAP/routines",
    ]) {
      expect(classifyShellRoute(pathname, "PAP").builtInContextualSurface).toBeNull();
    }
  });

  it("rejects a different company prefix", () => {
    expect(getCompanyPathSegments("/OTHER/issues/task-1", "PAP")).toEqual([]);
  });
});
