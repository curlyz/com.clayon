import { useCompany } from "@/context/CompanyContext";
import { ORG_DESTINATIONS, type NavDestinationGroup } from "@/lib/nav-destinations";
import { PluginSlotOutlet } from "@/plugins/slots";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { SidebarNavExpandedProvider } from "../SidebarNavItem";
import { SidebarAgents } from "../SidebarAgents";
import { DockGroup, DockGroupLabel, DockGroupSeparator, DockPanelBody, DockRow } from "./DockPanel";

/*
 * The dock's Org popover: organization and company-admin destinations from
 * the one shared list (lib/nav-destinations.ts — the sidebar renders the
 * same rows through SidebarNavItem), plus the live agents list (density law:
 * the dock layout loses the sidebar's agent rail, so it surfaces here) and
 * the plugin sidebar items.
 */

const GROUP_LABELS: Record<NavDestinationGroup, string> = {
  work: "Work",
  collections: "Collections",
  org: "Org",
  company: "Company",
};

export function DockOrgPanelBody({ close }: { close: () => void }) {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };
  const groups: NavDestinationGroup[] = ["org", "company"];

  return (
    <DockPanelBody>
      {groups.map((group, index) => (
        <DockGroup key={group}>
          <DockGroupLabel>{GROUP_LABELS[group]}</DockGroupLabel>
          {ORG_DESTINATIONS
            .filter((destination) => destination.group === group)
            .map((destination) => (
              <DockRow
                key={destination.to}
                to={destination.to}
                label={destination.label}
                icon={destination.icon}
                end={destination.to === "/company/settings"}
                onNavigate={close}
              />
            ))}
          {index < groups.length - 1 ? <DockGroupSeparator /> : null}
        </DockGroup>
      ))}
      {/* The sidebar's live agents section, surfaced for the dock layout
          (density law): live-run dots, per-agent menus, see-all link. The
          expanded provider forces full-label rows regardless of the sidebar
          collapse preference. */}
      <SidebarNavExpandedProvider>
        <SidebarAgents streamlined />
      </SidebarNavExpandedProvider>
      <SidebarNavExpandedProvider>
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
      </SidebarNavExpandedProvider>
    </DockPanelBody>
  );
}
