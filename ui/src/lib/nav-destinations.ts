import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CircleCheck,
  DollarSign,
  FolderOpen,
  GanttChartSquare,
  GitBranch,
  History,
  LayoutGrid,
  Layers,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Network,
  Package,
  Repeat,
  Search,
  Settings,
  Target,
  Unplug,
  Users,
} from "lucide-react";

/*
 * One shared destination list for the work/org navigation surfaces
 * (2026-10-11 redesign): the dock's Work/Org popovers and the sidebar's
 * Work/Org sections both render these rows, so a destination is added or
 * gated exactly once. The sidebar maps them through SidebarNavItem; the
 * dock maps them through DockRow. Badge data stays at the surface (the
 * sidebar and the dock slots attach their own live counts).
 */

export type NavDestinationGroup = "work" | "collections" | "org" | "company";

export type NavDestination = {
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavDestinationGroup;
};

/** Feature gates a work destination depends on (PAP-670 flags). */
export type WorkDestinationGates = {
  agentChatEnabled: boolean;
  streamlinedUiEnabled: boolean;
  enableIsolatedWorkspaces?: boolean;
  enablePipelines?: boolean;
  enableStatusCards?: boolean;
  enableGoalsSidebarLink?: boolean;
  enableDecisions?: boolean;
  enableCases?: boolean;
  enableConferenceRoomChat?: boolean;
};

export function buildWorkDestinations(gates: WorkDestinationGates): NavDestination[] {
  const destinations: NavDestination[] = [
    { to: "/search", label: "Search", icon: Search, group: "work" },
  ];
  if (gates.agentChatEnabled) {
    destinations.push({ to: "/chats", label: "Chat", icon: MessageCircle, group: "work" });
  }
  destinations.push({ to: "/issues", label: "Tasks", icon: CircleCheck, group: "work" });
  if (gates.enableDecisions) {
    destinations.push({ to: "/decisions", label: "Decisions", icon: ListChecks, group: "work" });
  }
  if (gates.enableStatusCards) {
    destinations.push({ to: "/status", label: "Status", icon: LayoutGrid, group: "work" });
  }
  if (gates.enableConferenceRoomChat) {
    destinations.push({ to: "/board-chat", label: "Conference Room", icon: MessagesSquare, group: "work" });
  }
  if (gates.streamlinedUiEnabled) {
    destinations.push({ to: "/projects", label: "Projects", icon: FolderOpen, group: "collections" });
  }
  destinations.push(
    { to: "/routines", label: "Routines", icon: Repeat, group: "collections" },
    { to: "/artifacts", label: "Artifacts", icon: Package, group: "collections" },
  );
  if (gates.enableCases) {
    destinations.push({ to: "/cases", label: "Cases", icon: Layers, group: "collections" });
  }
  if (gates.enablePipelines) {
    destinations.push({ to: "/pipelines", label: "Pipelines", icon: GitBranch, group: "collections" });
  }
  if (gates.enableGoalsSidebarLink) {
    destinations.push({ to: "/goals", label: "Goals", icon: Target, group: "collections" });
  }
  // PAP-670: Workspaces only while Agent Chat has not taken Chat's place.
  if (!gates.agentChatEnabled && gates.enableIsolatedWorkspaces === true) {
    destinations.push({ to: "/workspaces", label: "Workspaces", icon: GitBranch, group: "collections" });
  }
  return destinations;
}

export const ORG_DESTINATIONS: NavDestination[] = [
  { to: "/agents", label: "Agents", icon: Users, group: "org" },
  { to: "/skills", label: "Skills", icon: Boxes, group: "org" },
  { to: "/apps", label: "Connectors", icon: Unplug, group: "org" },
  { to: "/activity", label: "Audit", icon: History, group: "org" },
  { to: "/org", label: "Org Chart", icon: Network, group: "company" },
  { to: "/timeline", label: "Timeline", icon: GanttChartSquare, group: "company" },
  { to: "/costs", label: "Costs", icon: DollarSign, group: "company" },
  { to: "/company/settings", label: "Settings", icon: Settings, group: "company" },
];

/** First path segment ("/company/settings" → "company"), for route matching. */
export function destinationSegment(destination: NavDestination): string {
  return destination.to.split("/")[1] ?? "";
}

const ALL_WORK_GATES: WorkDestinationGates = {
  agentChatEnabled: true,
  streamlinedUiEnabled: true,
  enableIsolatedWorkspaces: true,
  enablePipelines: true,
  enableStatusCards: true,
  enableGoalsSidebarLink: true,
  enableDecisions: true,
  enableCases: true,
  enableConferenceRoomChat: true,
};

/** Route segments the work family can be active on (superset over gates). */
export const WORK_ROUTE_SEGMENTS = new Set(buildWorkDestinations(ALL_WORK_GATES).map(destinationSegment));

/** Route segments the org family can be active on. */
export const ORG_ROUTE_SEGMENTS = new Set(ORG_DESTINATIONS.map(destinationSegment));
