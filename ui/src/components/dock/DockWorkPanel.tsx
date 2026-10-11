import { useQuery } from "@tanstack/react-query";
import { attentionApi } from "@/api/attention";
import { heartbeatsApi } from "@/api/heartbeats";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { attentionBadgeCount } from "@/lib/attention";
import {
  buildWorkDestinations,
  type NavDestinationGroup,
} from "@/lib/nav-destinations";
import { useAgentChatEnabled } from "@/hooks/useAgentChatEnabled";
import { useStreamlinedUiEnabled } from "@/hooks/useStreamlinedUiEnabled";
import { useSharedPollingQuery, usePublishSharedQueryData } from "@/hooks/useSharedPolling";
import { SidebarNavExpandedProvider } from "../SidebarNavItem";
import { SidebarRecentTasks } from "../SidebarRecentTasks";
import { SidebarStarredProjects } from "../SidebarStarredProjects";
import { DockGroup, DockGroupLabel, DockGroupSeparator, DockPanelBody, DockRow } from "./DockPanel";

/*
 * The dock's Work popover: work destinations from the one shared list
 * (lib/nav-destinations.ts — the sidebar renders the same rows through
 * SidebarNavItem), plus the data-driven sections the dock layout lost from
 * the sidebar (density law: surface, never drop) — starred projects and
 * recent tasks with live-run marks.
 */

const GROUP_LABELS: Record<NavDestinationGroup, string> = {
  work: "Work",
  collections: "Collections",
  org: "Org",
  company: "Company",
};

export function DockWorkPanelBody({ close }: { close: () => void }) {
  const { selectedCompanyId } = useCompany();
  const { enabled: agentChatEnabled } = useAgentChatEnabled();
  const { enabled: streamlinedUiEnabled } = useStreamlinedUiEnabled();
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const showDecisions = experimentalSettings?.enableDecisions === true;
  const { data: attentionFeed } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && showDecisions,
    refetchInterval: 60_000,
  });
  const decisionsCount = attentionBadgeCount(attentionFeed);

  // Live-run ids for the recent-tasks marks — the same shared-polling shape
  // the primary sidebar uses, so both surfaces read one cache.
  const liveRunsQueryKey = queryKeys.liveRuns(selectedCompanyId!);
  const sharedLiveRuns = useSharedPollingQuery({
    companyId: selectedCompanyId,
    resourceKey: "live-runs",
    queryKey: liveRunsQueryKey,
    enabled: !!selectedCompanyId,
    refetchInterval: false,
    leaderOnly: true,
  });
  const { data: liveRuns, dataUpdatedAt: liveRunsUpdatedAt } = useQuery({
    queryKey: liveRunsQueryKey,
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: sharedLiveRuns.enabled,
    refetchInterval: sharedLiveRuns.refetchInterval,
  });
  usePublishSharedQueryData(sharedLiveRuns, liveRuns, liveRunsUpdatedAt);
  const liveIssueIds = new Set(
    (liveRuns ?? []).flatMap((run) => run.issueId ? [run.issueId] : []),
  );

  const destinations = buildWorkDestinations({
    agentChatEnabled,
    streamlinedUiEnabled,
    enableIsolatedWorkspaces: experimentalSettings?.enableIsolatedWorkspaces,
    enablePipelines: experimentalSettings?.enablePipelines,
    enableStatusCards: experimentalSettings?.enableStatusCards,
    enableGoalsSidebarLink: experimentalSettings?.enableGoalsSidebarLink,
    enableDecisions: experimentalSettings?.enableDecisions,
    enableCases: experimentalSettings?.enableCases,
    enableConferenceRoomChat: experimentalSettings?.enableConferenceRoomChat,
  });
  const groups: NavDestinationGroup[] = ["work", "collections"];

  return (
    <DockPanelBody>
      {groups.map((group, index) => (
        <DockGroup key={group}>
          <DockGroupLabel>{GROUP_LABELS[group]}</DockGroupLabel>
          {destinations
            .filter((destination) => destination.group === group)
            .map((destination) => (
              <DockRow
                key={destination.to}
                to={destination.to}
                label={destination.label}
                icon={destination.icon}
                badge={destination.to === "/decisions" ? decisionsCount : undefined}
                badgeLabel="decisions"
                onNavigate={close}
              />
            ))}
          {index < groups.length - 1 ? <DockGroupSeparator /> : null}
        </DockGroup>
      ))}
      {/* The sidebar's data-driven Work sections, surfaced for the dock
          layout (density law). The expanded provider forces full-label rows
          regardless of the sidebar collapse preference. */}
      <SidebarNavExpandedProvider>
        <SidebarStarredProjects />
        <SidebarRecentTasks companyId={selectedCompanyId} liveIssueIds={liveIssueIds} />
      </SidebarNavExpandedProvider>
    </DockPanelBody>
  );
}
