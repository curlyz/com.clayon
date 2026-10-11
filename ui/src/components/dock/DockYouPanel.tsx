import type { DeploymentMode } from "@clayon/shared";
import { PanelBottom, PanelLeft } from "lucide-react";
import { useNavLayout, setNavLayout, type NavLayout } from "@/stores/navLayoutStore";
import { cn } from "@/lib/utils";
import { AccountMenuHeader, AccountMenuRows } from "../AccountMenuBody";

/*
 * The dock's You popover: the shared account menu body
 * (AccountMenuBody.tsx — the sidebar's account footer renders the same
 * header and rows) plus the nav layout preference selector (ADDENDUM 2):
 * a two-option row, one click switches dock/sidebar primary navigation.
 */

function NavLayoutOption({
  value,
  label,
  icon: Icon,
  active,
}: {
  value: NavLayout;
  label: string;
  icon: typeof PanelBottom;
  active: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => setNavLayout(value)}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-(length:--text-compact) font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </button>
  );
}

function NavLayoutSelector() {
  const navLayout = useNavLayout();
  return (
    <div className="flex items-center justify-between gap-2 px-2.5">
      <span className="text-(length:--text-compact) font-medium text-foreground">Navigation</span>
      <div role="group" aria-label="Navigation layout" className="flex gap-0.5 rounded-lg bg-muted p-0.5">
        <NavLayoutOption value="dock" label="Dock" icon={PanelBottom} active={navLayout === "dock"} />
        <NavLayoutOption value="sidebar" label="Sidebar" icon={PanelLeft} active={navLayout === "sidebar"} />
      </div>
    </div>
  );
}

export function DockYouPanelBody({ deploymentMode, close }: { deploymentMode?: DeploymentMode; close: () => void }) {
  return (
    <div className="flex flex-col">
      <AccountMenuHeader close={close} />
      <div className="flex flex-1 flex-col gap-0.5 border-t border-border pb-2.5 pt-2">
        <NavLayoutSelector />
        <div className="border-t border-border" aria-hidden="true" />
        <AccountMenuRows deploymentMode={deploymentMode} close={close} />
      </div>
    </div>
  );
}

export { deriveInitials } from "../AccountMenuBody";
