export type ContextualSidebarSurface =
  | "settings"
  | "apps"
  | "agent"
  | "routine"
  | "skills"
  | `plugin:${string}`;

export interface ShellRouteClassification {
  companySegments: string[];
  isTaskDetail: boolean;
  builtInContextualSurface: Exclude<ContextualSidebarSurface, `plugin:${string}`> | null;
}

export function getCompanyPathSegments(pathname: string, companyPrefix: string | undefined): string[] {
  if (!companyPrefix) return [];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return [];
  if (segments[0]?.toUpperCase() !== companyPrefix.toUpperCase()) return [];
  return segments.slice(1);
}

export function classifyShellRoute(
  pathname: string,
  companyPrefix: string | undefined,
): ShellRouteClassification {
  const companySegments = getCompanyPathSegments(pathname, companyPrefix);
  const root = companySegments[0]?.toLowerCase();
  const isCompanySettings = root === "company" && ["settings", "export", "import"].includes(
    companySegments[1]?.toLowerCase() ?? "",
  );
  const agentSegment = companySegments[1]?.toLowerCase();
  const isAgentDetail = root === "agents"
    && Boolean(agentSegment)
    && agentSegment !== "new"
    && !["all", "active", "paused", "error", "builtin"].includes(agentSegment ?? "");
  const isRoutineDetail = root === "routines" && companySegments.length >= 2;
  const isSkillsSurface = root === "skills";

  return {
    companySegments,
    isTaskDetail: (root === "issues" || root === "chats") && companySegments.length >= 2,
    builtInContextualSurface: isCompanySettings
      ? "settings"
      : root === "apps" || root === "tools"
        ? "apps"
        : isAgentDetail
          ? "agent"
          : isRoutineDetail
            ? "routine"
            : isSkillsSurface
              ? "skills"
        : null,
  };
}
