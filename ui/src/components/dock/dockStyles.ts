import { cn } from "@/lib/utils";

/*
 * Shared class law for the bottom dock (Liquid Gold dock shape, 2026-10-11
 * redesign). Every dock control is a compact icon-only utility: labels live
 * on aria-label, the active or open slot gets a quiet accent fill, and
 * primary is reserved for the New Task accent button — the one loud thing
 * on the dock. Leaf controls: each slot owns its own centring; sizes come
 * from the --bottomnav-* and --sz-dock-* tokens in ui/src/index.css.
 */

/** One capsule slot: an icon-only control, 44px square. */
export const dockSlotClass = (active: boolean): string =>
  cn(
    "flex size-11 flex-none items-center justify-center rounded-full transition-colors",
    "hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[state=open]:bg-accent data-[state=open]:text-foreground",
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** The round accent New Task button beside the capsule. */
export const dockAccentClass =
  "pointer-events-auto flex size-(--bottomnav-height) shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-(--shadow-dock) transition-transform hover:bg-primary/90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The one size rule every dock popover shares (Gold DockPanel shape). */
export const dockPanelClass = "w-(--sz-dock-panel) max-h-(--sz-dock-panel-max-h) overflow-y-auto overscroll-contain p-0";

/** A leaf destination row inside a dock popover. */
export const dockRowClass = (active: boolean): string =>
  cn(
    "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium transition-colors",
    active ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground",
  );

/** A plain-text group label row (leaf) inside a dock popover. */
export const dockGroupLabelClass =
  "px-2.5 pb-1 pt-2 text-(length:--text-micro) font-medium text-muted-foreground";
