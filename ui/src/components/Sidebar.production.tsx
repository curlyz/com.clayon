import {
  Inbox,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Settings,
  Unplug,
  GanttChartSquare,
} from "lucide-react";
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/lib/router";
import { buildWorkDestinations } from "../lib/nav-destinations";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem.production";
import { SidebarSubNav } from "./SidebarSubNav";
import { buildRoutineSectionTabs } from "../lib/section-tabs/routineSectionTabs";
import { SKILLS_SECTION_TABS } from "../lib/section-tabs/skillsSectionTabs";
import { SidebarAgents } from "./SidebarAgents.production";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarStarredProjects } from "./SidebarStarredProjects.production";
import { useDialogActions } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { attentionApi } from "../api/attention";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { attentionBadgeCount } from "../lib/attention";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { usePublishSharedQueryData, useSharedPollingQuery } from "../hooks/useSharedPolling";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, SIDEBAR_RAIL_HIDDEN_LABEL } from "../lib/utils";
import { PluginSlotOutlet } from "@/plugins/slots";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu.production";
import { primarySidebarStyles } from "./primary-sidebar-styles";

export function Sidebar() {
  const { openNewIssue } = useDialogActions();
  // Every labeled section is collapsible (session-scoped, default open) —
  // one policy across static nav groups and the data-driven sections.
  const [workOpen, setWorkOpen] = useState(true);
  const [companyOpen, setCompanyOpen] = useState(true);
  const { selectedCompanyId, selectedCompany } = useCompany();
  const location = useLocation();
  // Sidebar-layout nested sub-nav (redesign ADDENDUM 2/3): the section list
  // renders under the active primary item, rows hash-anchor into the long
  // page at that item's base route. The company prefix (e.g. `/ANA/`) is
  // optional in the pattern, mirroring the agent match in SidebarAgents.
  const activeRoutineId = location.pathname.match(/^\/(?:[^/]+\/)?routines\/([^/]+)/)?.[1] ?? null;
  const skillsBaseActive = /^\/(?:[^/]+\/)?skills\/?$/.test(location.pathname);
  const { collapsed, peeking } = useSidebar();
  const rail = collapsed && !peeking;
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const liveRunsQueryKey = queryKeys.liveRuns(selectedCompanyId!);
  const sharedLiveRuns = useSharedPollingQuery({
    companyId: selectedCompanyId,
    resourceKey: "live-runs",
    queryKey: liveRunsQueryKey,
    enabled: !!selectedCompanyId,
    // Event-sourced via LiveUpdatesProvider (GitHub issue 9627) + reconnect reconcile — no
    // interval poll needed. Polling here also re-armed React Query's timer on
    // every live-event cache write, a major source of steady-state churn.
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
  const liveRunCount = liveRuns?.length ?? 0;
  const showApps = experimentalSettings?.enableApps === true;
  const showPipelines = experimentalSettings?.enablePipelines === true;
  const showStatusCards = experimentalSettings?.enableStatusCards === true;
  const goalsLinkPending = experimentalSettings === undefined;
  const showGoalsLink = experimentalSettings?.enableGoalsSidebarLink === true;
  // Decisions (attention home) is an experimental surface (PAP-13481): the nav
  // item is hidden entirely until the flag is enabled (same no-flash pattern as
  // showWorkspacesLink — it defaults hidden, so no placeholder is needed).
  const showDecisions = experimentalSettings?.enableDecisions === true;
  const { data: attentionFeed } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && showDecisions,
    refetchInterval: 60_000,
  });
  const attentionCount = attentionBadgeCount(attentionFeed);
  const showCases = experimentalSettings?.enableCases === true;
  // Streamlined left navigation (top-level Projects link + starred children) is
  // now the standard product sidebar (PAP-12472). The former experimental
  // opt-out was retired; classic per-project collapsible mode is no longer
  // user-selectable. Kept as a constant so the classic branch below stays as a
  // documented reference until it is fully removed. Routes are unaffected.
  const streamlined = true;
  // Conference Room Chat flag (PAP-136/PAP-137): the Conference Room nav item
  // is a new surface, hidden entirely while the flag is off (same no-flash
  // pattern as showWorkspacesLink above).
  const conferenceRoomChatEnabled = experimentalSettings?.enableConferenceRoomChat === true;

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  // One shared destination list (lib/nav-destinations): membership, gates and
  // order come from there — the dock's Work/Org popovers and the dev-world
  // sidebar render the same rows — so this surface only places rows and
  // attaches its own badges. The top group owns the capsule-slot equivalents
  // (Search/Dashboard/Inbox); the Work section owns Tasks, the collections,
  // and this world's Skills entry.
  const workDestinations = buildWorkDestinations({
    agentChatEnabled: false,
    streamlinedUiEnabled: streamlined,
    enableIsolatedWorkspaces: experimentalSettings?.enableIsolatedWorkspaces,
    enablePipelines: showPipelines,
    enableStatusCards: showStatusCards,
    enableGoalsSidebarLink: experimentalSettings?.enableGoalsSidebarLink,
    enableDecisions: showDecisions,
    enableCases: showCases,
    enableConferenceRoomChat: conferenceRoomChatEnabled,
  });
  const topGroupDestinations = workDestinations.filter(
    (destination) =>
      destination.group === "work"
      && destination.to !== "/search"
      && destination.to !== "/issues"
      && destination.to !== "/chats",
  );
  const workSectionDestinations = workDestinations.filter(
    (destination) =>
      destination.group === "collections"
      || destination.to === "/issues"
      || destination.to === "/chats",
  );

  return (
    <aside className="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: company name, aligned with top sections and borderless.
          Search deliberately does NOT live here:
          the header's spare width goes to the workspace/organization name,
          which is the user's orientation anchor and truncates otherwise.
          Search is the first nav item below instead. */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        <SidebarCompanyMenu />
      </div>

      <nav className={primarySidebarStyles.nav}>
        <div className="flex flex-col gap-0.5">
          {/* New Task button aligned with nav items */}
          {(() => {
            const newTaskButton = (
              <button
                onClick={() => openNewIssue()}
                data-slot="icon-button"
                aria-label={rail ? "New Task" : undefined}
                className={cn(
                  // The one confident accent role (operator directive
                  // 2026-10-11): New Task is the sidebar's only solid
                  // primary action — a leaf that pads itself, full-bleed.
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 pointer-coarse:py-1 text-(length:--text-compact) font-medium transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <SquarePen className="h-4 w-4 shrink-0" />
                <span className={rail ? SIDEBAR_RAIL_HIDDEN_LABEL : "truncate"}>New Task</span>
              </button>
            );
            return rail ? (
              <Tooltip>
                <TooltipTrigger asChild>{newTaskButton}</TooltipTrigger>
                <TooltipContent side="right">New Task</TooltipContent>
              </Tooltip>
            ) : (
              newTaskButton
            );
          })()}
          {/* Search moved out of the header so the workspace name keeps the
              width; a nav row also keeps search reachable from the
              collapsed rail, where the old header icon was dropped entirely.
              Cmd/Ctrl+K remains the keyboard path (command palette). */}
          <SidebarNavItem to="/search" label="Search" icon={Search} />
          <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label="Inbox"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeLabel="unread"
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          {topGroupDestinations.map((destination) =>
            destination.to === "/decisions" ? (
              <SidebarNavItem
                key={destination.to}
                to={destination.to}
                label={destination.label}
                icon={destination.icon}
                badge={attentionCount}
                badgeLabel="decisions"
              />
            ) : destination.to === "/status" ? (
              <SidebarNavItem
                key={destination.to}
                to={destination.to}
                label={destination.label}
                icon={destination.icon}
                textBadge="beta"
              />
            ) : (
              <SidebarNavItem
                key={destination.to}
                to={destination.to}
                label={destination.label}
                icon={destination.icon}
              />
            ),
          )}
        </div>

        <SidebarSection label="Work" collapsible={{ open: workOpen, onOpenChange: setWorkOpen }}>
          {workSectionDestinations.map((destination) => {
            if (destination.to === "/projects") {
              return (
                <Fragment key={destination.to}>
                  <SidebarNavItem to={destination.to} label={destination.label} icon={destination.icon} />
                  {streamlined ? <SidebarStarredProjects /> : null}
                </Fragment>
              );
            }
            // The routines sub-nav anchors into the open routine's long page.
            if (destination.to === "/routines") {
              return (
                <Fragment key={destination.to}>
                  <SidebarNavItem to={destination.to} label={destination.label} icon={destination.icon} />
                  {activeRoutineId ? (
                    <SidebarSubNav
                      basePath={`/routines/${activeRoutineId}`}
                      sections={buildRoutineSectionTabs(activeRoutineId)}
                    />
                  ) : null}
                </Fragment>
              );
            }
            if (destination.to === "/cases") {
              return (
                <SidebarNavItem
                  key={destination.to}
                  to={destination.to}
                  label={destination.label}
                  icon={destination.icon}
                  textBadge="beta"
                />
              );
            }
            return <SidebarNavItem key={destination.to} to={destination.to} label={destination.label} icon={destination.icon} />;
          })}
          {/* Goals reserves its slot while the experimental settings load
              (the destination itself is not in the list until the flag
              resolves, so the placeholder renders beside the map). */}
          {goalsLinkPending && !showGoalsLink ? (
            <div
              data-testid="sidebar-goals-placeholder"
              className="h-8 pointer-coarse:h-7"
              aria-hidden="true"
            />
          ) : null}
          {/* This world keeps its Skills entry inside Work (the dev world's
              Org section and the dock's Org popover own it there); the skills
              sub-nav anchors into the skills long page. */}
          <SidebarNavItem to="/skills" label="Skills" icon={Boxes} />
          {skillsBaseActive ? (
            <SidebarSubNav basePath="/skills" sections={SKILLS_SECTION_TABS} />
          ) : null}
          <PluginSlotOutlet
            errorBehavior="hidden"
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-(length:--text-compact) font-medium"
            missingBehavior="placeholder"
          />
          <PluginLauncherOutlet
            errorBehavior="hidden"
            placementZones={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-(length:--text-compact) font-medium"
          />
        </SidebarSection>

        {/* Classic mode restores the per-project collapsible below Work. */}
        {streamlined ? null : <SidebarProjects />}

        <SidebarAgents streamlined={streamlined} />

        <SidebarSection label="Company" collapsible={{ open: companyOpen, onOpenChange: setCompanyOpen }}>
          <SidebarNavItem to="/org" label="Org" icon={Network} />
          {showApps ? <SidebarNavItem to="/apps" label="Connectors" icon={Unplug} /> : null}
          <SidebarNavItem to="/timeline" label="Timeline" icon={GanttChartSquare} />
          <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
          {/* One entry — /audit merged into the rich Activity feed (PAP-16302). */}
          <SidebarNavItem to="/activity" label="Activity" icon={History} />
          <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          errorBehavior="hidden"
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className={cn(primarySidebarStyles.band, "flex flex-col gap-3")}
          itemClassName="rounded-md border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
