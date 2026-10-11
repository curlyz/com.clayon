import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import type { DeploymentMode } from "@clayon/shared";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";
import { useCloudInstance } from "@/hooks/useCloudInstance";
import { useSidebar } from "../context/SidebarContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, SIDEBAR_RAIL_HIDDEN_LABEL } from "../lib/utils";
import { primarySidebarStyles } from "./primary-sidebar-styles";
import { AccountMenuHeader, AccountMenuRows, deriveInitials } from "./AccountMenuBody";

const FEEDBACK_URL = "https://clayon.ing/feedback";

interface SidebarAccountMenuProps {
  deploymentMode?: DeploymentMode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SidebarAccountMenu({
  deploymentMode,
  open: controlledOpen,
  onOpenChange,
}: SidebarAccountMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  // Cloud hides the classic feedback affordance (the shared menu rows handle
  // their own cloud gating).
  const cloud = useCloudInstance();
  const isCloud = Boolean(cloud);
  const { isMobile, setSidebarOpen, collapsed, peeking } = useSidebar();
  const rail = collapsed && !peeking;
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const displayName = session?.user.name?.trim() || "Board";
  const initials = deriveInitials(displayName);

  function closeNavigationChrome() {
    setOpen(false);
    if (isMobile) setSidebarOpen(false);
  }

  return (
    // Sidebar column law: same surface as the column (bg-sidebar family),
    // separated by the one hairline token. Leaf-node: the band and its row
    // wrapper carry no padding; the account trigger is the leaf that pads,
    // full-bleed (operator directive 2026-10-11).
    <div className="border-t border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-0.5">
        <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              primarySidebarStyles.row,
              primarySidebarStyles.rowMuted,
              "min-w-0 text-left py-2",
              rail ? "w-full justify-center px-0" : "flex-1",
            )}
            aria-label="Open account menu"
          >
            <Avatar size="sm">
              {session?.user.image ? <AvatarImage src={session.user.image} alt={displayName} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className={cn("min-w-0 flex-1 truncate", rail && SIDEBAR_RAIL_HIDDEN_LABEL)}>{displayName}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          className="min-h-(--profile-popover-min-height) w-(--profile-popover-width) max-w-(--sz-calc-24) overflow-hidden rounded-xl border-border bg-popover p-0 shadow-(--shadow-profile-popover)"
        >
          {/* Shared account menu body (AccountMenuBody.tsx): the dock's You
              popover renders the same header + rows. */}
          <AccountMenuHeader close={closeNavigationChrome} />
          <div className="flex flex-1 flex-col gap-0.5 border-t border-border px-2.5 pb-2.5 pt-2">
            <AccountMenuRows deploymentMode={deploymentMode} close={closeNavigationChrome} />
          </div>
        </PopoverContent>
        </Popover>
        {!rail && !isCloud ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={FEEDBACK_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Share feedback"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="top">Share feedback</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
