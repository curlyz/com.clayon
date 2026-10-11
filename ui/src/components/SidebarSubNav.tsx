import { Fragment } from "react";
import { Link, useLocation } from "@/lib/router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { useSidebar } from "../context/SidebarContext";
import { primarySidebarStyles } from "./primary-sidebar-styles";

export type SidebarSubNavSection = {
  id: string;
  label: string;
  icon?: LucideIcon;
  group?: string;
};

type SidebarSubNavProps = {
  /** Base route of the long page the sections anchor on (ADDENDUM 3). */
  basePath: string;
  sections: readonly SidebarSubNavSection[];
};

/**
 * Nested sub-nav rendered under the active primary sidebar item in the
 * "sidebar" nav layout (redesign brief ADDENDUM 2 + 3). Each row links to
 * `#<section-id>` on the surface's base route — the one long page — and its
 * active state follows the URL hash, which the page's scroll-spy keeps
 * current via `history.replaceState`. Rows are indented full-bleed leaves of
 * the primary sidebar contract.
 */
export function SidebarSubNav({ basePath, sections }: SidebarSubNavProps) {
  const { isMobile, setSidebarOpen, collapsed, peeking } = useSidebar();
  const rail = collapsed && !peeking;
  const { hash } = useLocation();

  // The rail has no room for a nested level; the dock-layout page tab strip
  // covers section navigation there.
  if (rail || sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {sections.map((section, index) => {
        const sectionHash = `#${section.id}`;
        const isActive = hash === sectionHash;
        const Icon = section.icon;
        // Group labels read like the section labels above: plain leaf title
        // rows, only when the group starts (ADDENDUM 3: plain text, no pills).
        const startsGroup = section.group != null && section.group !== sections[index - 1]?.group;
        return (
          <Fragment key={section.id}>
            {startsGroup ? (
              <span className={cn(primarySidebarStyles.label, "px-3 py-1")}>
                {section.group}
              </span>
            ) : null}
            <Link
              to={`${basePath}${sectionHash}`}
              state={SIDEBAR_SCROLL_RESET_STATE}
              onClick={() => {
                if (isMobile) setSidebarOpen(false);
              }}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                primarySidebarStyles.row,
                // Indented leaf row under its parent item.
                "pl-6",
                isActive ? primarySidebarStyles.rowActive : primarySidebarStyles.rowMuted,
              )}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
            </Link>
          </Fragment>
        );
      })}
    </div>
  );
}
