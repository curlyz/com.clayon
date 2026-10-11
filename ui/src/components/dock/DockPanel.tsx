import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "@/lib/router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { SIDEBAR_SCROLL_RESET_STATE } from "@/lib/navigation-scroll";
import { cn } from "@/lib/utils";
import { dockGroupLabelClass, dockPanelClass, dockRowClass, dockSlotClass } from "./dockStyles";

/*
 * Shared dock popover plumbing (Gold DockPanel shape): one slot trigger and
 * the one size rule every panel shares — side="top", sideOffset 12, at most
 * 24rem wide / 60dvh tall, scrolling inside. Panels are bands: rows are
 * leaves that carry their own padding, groups separate with one hairline,
 * group labels are plain leaf text rows.
 */

interface DockPanelSlotProps {
  label: string;
  icon?: LucideIcon;
  /** Pre-rendered trigger content for slots whose glyph isn't a plain Lucide icon (e.g. the You avatar). */
  iconNode?: ReactNode;
  /** Marks the slot with the current page when the active surface lives inside this panel. */
  active?: boolean;
  children: (close: () => void) => ReactNode;
}

export function DockPanelSlot({ label, icon: Icon, iconNode, active = false, children }: DockPanelSlotProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={dockSlotClass(active)}
        >
          {iconNode ?? (Icon ? <Icon aria-hidden className="size-5" strokeWidth={1.75} /> : null)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        collisionPadding={8}
        aria-label={label}
        className={dockPanelClass}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** A plain-text group label row (leaf) at the top of a panel band. */
export function DockGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className={dockGroupLabelClass}>
      {children}
    </p>
  );
}

/** One hairline band separator between panel groups. */
export function DockGroupSeparator() {
  return <div className="border-t border-border" aria-hidden="true" />;
}

interface DockRowProps {
  to: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  badgeLabel?: string;
  end?: boolean;
  onNavigate: () => void;
}

/** A leaf destination row inside a dock popover. */
export function DockRow({ to, label, icon: Icon, badge, badgeLabel, end, onNavigate }: DockRowProps) {
  const hasBadge = badge != null && badge > 0;
  return (
    <NavLink
      to={to}
      end={end}
      state={SIDEBAR_SCROLL_RESET_STATE}
      onClick={onNavigate}
      className={({ isActive }) => dockRowClass(isActive)}
    >
      {Icon ? (
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hasBadge ? (
        <Badge
          variant="ghost"
          aria-label={badgeLabel ? `${badge} ${badgeLabel}` : undefined}
          className="bg-primary px-1.5 leading-none text-primary-foreground"
        >
          {badge > 99 ? "99+" : badge}
        </Badge>
      ) : null}
    </NavLink>
  );
}

/** The panel body: groups of rows separated by hairlines, gap-only rhythm. */
export function DockPanelBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col pb-1.5">{children}</div>;
}

/** One group band: label + rows with one gap rhythm. */
export function DockGroup({ children }: { children: ReactNode }) {
  return <div className={cn("flex flex-col gap-0.5")}>{children}</div>;
}
