import {
  Briefcase,
  CircleCheck,
  Inbox as InboxIcon,
  LayoutDashboard,
  SquarePen,
  Users,
} from "lucide-react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { DeploymentMode } from "@clayon/shared";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import { useDialogActions } from "@/context/DialogContext";
import { useInboxBadge } from "@/hooks/useInboxBadge";
import { useCombinedInboxTasksEnabled } from "@/hooks/useCombinedInboxTasksEnabled";
import { extractCompanyPrefixFromPath } from "@/lib/company-routes";
import { ORG_ROUTE_SEGMENTS, WORK_ROUTE_SEGMENTS } from "@/lib/nav-destinations";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SIDEBAR_SCROLL_RESET_STATE } from "@/lib/navigation-scroll";
import { dockAccentClass, dockSlotClass } from "./dockStyles";
import { DockPanelSlot } from "./DockPanel";
import { DockWorkPanelBody } from "./DockWorkPanel";
import { DockOrgPanelBody } from "./DockOrgPanel";
import { DockYouPanelBody } from "./DockYouPanel";
import { deriveInitials } from "../AccountMenuBody";

/*
 * The bottom dock: the one primary navigation in the "dock" layout, and the
 * below-lg navigation in the "sidebar" layout (ADDENDUM 2, 2026-10-11
 * redesign; Gold reference: com.liquidgold BottomNav/DockPanel). A floating
 * capsule of icon-only slots over the content column — Home, Inbox, Tasks,
 * Work and Org popovers, You account popover — plus one round primary
 * accent: New Task. It is a pure overlay: scroll owners clear it with
 * --sz-dock-clearance (index.css), there is no spacer.
 *
 * Capsule slot budget is 6 × 44px inside max-w-80 beside the accent button
 * on a 390px viewport; wider destinations live in the Work/Org popovers.
 */

function contentSegments(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  if (extractCompanyPrefixFromPath(pathname)) return parts.slice(1);
  return parts;
}

function usePanelActive(): { workActive: boolean; orgActive: boolean } {
  const location = useLocation();
  const segments = contentSegments(location.pathname);
  const first = segments[0]?.toLowerCase() ?? "";
  // Route membership derives from the shared destination list
  // (lib/nav-destinations.ts), the same rows the panels render.
  return { workActive: WORK_ROUTE_SEGMENTS.has(first), orgActive: ORG_ROUTE_SEGMENTS.has(first) };
}

interface DockSlotLinkProps {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  badgeLabel?: string;
}

function DockSlotLink({ to, label, icon: Icon, badge, badgeLabel }: DockSlotLinkProps) {
  const hasBadge = badge != null && badge > 0;
  const ariaLabel = hasBadge && badgeLabel ? `${label}, ${badge} ${badgeLabel}` : label;
  return (
    <NavLink
      to={to}
      state={SIDEBAR_SCROLL_RESET_STATE}
      aria-label={ariaLabel}
      className={({ isActive }) => dockSlotClass(isActive)}
    >
      <span className="relative flex items-center justify-center">
        <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        {hasBadge ? (
          <span
            className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-primary"
            aria-hidden="true"
          />
        ) : null}
      </span>
    </NavLink>
  );
}

interface DockProps {
  /** Hidden shells: a modal sidebar open below lg removes the dock. */
  hidden?: boolean;
  /** In the sidebar layout the dock is the below-lg navigation only. */
  sidebarLayout?: boolean;
  deploymentMode?: DeploymentMode;
}

export function Dock({ hidden = false, sidebarLayout = false, deploymentMode }: DockProps) {
  const { openNewIssue } = useDialogActions();
  const { selectedCompanyId } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { enabled: combinedInboxTasksEnabled } = useCombinedInboxTasksEnabled();
  const { workActive, orgActive } = usePanelActive();
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const location = useLocation();
  const newTaskActive = /\/issues\/new(?:\/|$)/.test(location.pathname);

  if (hidden) return null;

  // PAP-670 badge law, one definition: with Combined Inbox + Task List the
  // unread badge rides on Tasks; otherwise Inbox carries it.
  const inboxSlotBadge = combinedInboxTasksEnabled ? undefined : inboxBadge.inbox;
  const tasksSlotBadge = combinedInboxTasksEnabled ? inboxBadge.inbox : undefined;

  const displayName = session?.user.name?.trim() || "Board";
  const initials = deriveInitials(displayName);
  const youGlyph = (
    <Avatar className="size-6">
      {session?.user.image ? <AvatarImage src={session.user.image} alt={displayName} /> : null}
      <AvatarFallback className="text-(length:--text-nano)">{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <div
      data-bottom-dock
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-(--bottomnav-bottom-offset) z-(--z-dock) flex items-center justify-center gap-2 px-3 print:hidden",
        sidebarLayout && "lg:hidden",
      )}
    >
      <nav
        aria-label="Primary navigation"
        className="pointer-events-auto flex h-(--bottomnav-height) min-w-0 max-w-80 flex-1 items-center rounded-full border border-border bg-popover px-1.5 text-popover-foreground shadow-(--shadow-dock)"
      >
        <DockSlotLink to="/dashboard" label="Home" icon={LayoutDashboard} />
        <DockSlotLink
          to="/inbox"
          label="Inbox"
          icon={InboxIcon}
          badge={inboxSlotBadge}
          badgeLabel="unread"
        />
        <DockSlotLink
          to="/issues"
          label="Tasks"
          icon={CircleCheck}
          badge={tasksSlotBadge}
          badgeLabel="unread"
        />
        <DockPanelSlot label="Work" icon={Briefcase} active={workActive}>
          {(close) => <DockWorkPanelBody close={close} />}
        </DockPanelSlot>
        <DockPanelSlot label="Org" icon={Users} active={orgActive}>
          {(close) => <DockOrgPanelBody close={close} />}
        </DockPanelSlot>
        <div className="ml-auto flex flex-none items-center">
          <DockPanelSlot label="You" iconNode={youGlyph}>
            {(close) => <DockYouPanelBody deploymentMode={deploymentMode} close={close} />}
          </DockPanelSlot>
        </div>
      </nav>
      <button
        type="button"
        aria-label="New Task"
        aria-current={newTaskActive ? "page" : undefined}
        onClick={() => openNewIssue()}
        className={dockAccentClass}
      >
        <SquarePen aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
