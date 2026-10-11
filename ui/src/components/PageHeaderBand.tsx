import type { ReactNode } from "react";
import { cn } from "../lib/utils";

/**
 * One page-header band per page (leaf-node law): title and tab strip together,
 * one step darker than the page (`bg-muted/50`), full bleed, closed by a
 * single hairline. Everything below it — section titles, filter rows, bodies —
 * carries no fill.
 */
export function PageHeaderBand({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  /** Trailing actions rendered on the title row (right-aligned). */
  actions?: ReactNode;
  /** The tab strip (PageTabBar in Tabs) rendered inside the same band. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border bg-muted/50 px-4 pb-3 pt-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
