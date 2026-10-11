/**
 * Shared visual contract for the primary navigation surface (leaf-node law,
 * DESIGN.md). Settings reuses this contract when it takes over the global
 * sidebar.
 *
 * Leaf-only padding: the nav and group wrappers position children with `gap`
 * only — no `px`/`py` on containers. Every row (nav item, section label,
 * "See all agents", recent-task row) is the one leaf that pads, full-bleed
 * across the sidebar, with no `mx-*`. Rows carry no rounded pill; the active
 * row is a full-bleed `bg-sidebar-accent` band (operator directive
 * 2026-10-11).
 */
export const primarySidebarStyles = {
  surface: "primary-sidebar-surface",
  nav: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scrollbar-auto-hide pointer-coarse:gap-3",
  group: "flex flex-col gap-0.5",
  /** Full-bleed leaf row. The one place horizontal padding lives. */
  row: "flex items-center gap-2.5 px-3 py-1.5 pointer-coarse:py-1 text-(length:--text-compact) font-medium transition-colors",
  /** Section/group label typography (plain title text, no chrome). */
  label: "text-(length:--text-nano) font-medium uppercase tracking-widest font-mono text-muted-foreground/60",
  /** Active leaf row: the single allowed highlight fill, no rounding. */
  rowActive: "bg-sidebar-accent text-sidebar-accent-foreground",
  /** Resting + hover leaf row. */
  rowMuted: "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  /** Sibling sections are bands split by one hairline; the first has none. */
  band: "border-t border-border first:border-t-0",
} as const;
