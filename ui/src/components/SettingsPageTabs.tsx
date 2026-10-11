import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { sidebarBadgesApi } from "@/api/sidebarBadges";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import { useCloudInstance } from "@/hooks/useCloudInstance";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { usePluginSlots } from "@/plugins/slots";
import { SectionTabs, type SectionTabsItem } from "./SectionTabs";

/**
 * Page tabs for the settings surface (operator: settings use page tabs, not a
 * sub sidebar). One route strip carrying the same entries and visibility
 * rules the settings sidebar had; per-plugin settings pages stay reachable
 * under the Plugins tab (the Plugins page lists them).
 */
export function SettingsPageTabs() {
  const { selectedCompanyId } = useCompany();
  const { hidden: hiddenSettings } = useHiddenSettings();
  const showPage = (pageKey: string) => !hiddenSettings.has(pageKey);
  // Import is floored server-side on cloud-managed instances, so the tab is
  // hidden rather than dead-ending. Export stays available.
  const isCloud = Boolean(useCloudInstance());
  const { slots: companySettingsPluginSlots } = usePluginSlots({
    slotTypes: ["companySettingsPage"],
    companyId: selectedCompanyId,
    enabled: !!selectedCompanyId,
  });
  const { data: badges } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.sidebarBadges(selectedCompanyId)
      : ["sidebar-badges", "__disabled__"] as const,
    queryFn: async () => {
      try {
        return await sidebarBadgesApi.get(selectedCompanyId!);
      } catch (error) {
        // A board without settings access just hides the badges instead of
        // surfacing an error; other failures stay errors.
        const apiError = z.object({ status: z.number() }).safeParse(error);
        if (apiError.success && (apiError.data.status === 401 || apiError.data.status === 403)) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!selectedCompanyId,
    retry: false,
    refetchInterval: 15_000,
  });

  const items: SectionTabsItem[] = [
    { id: "general", label: "General", to: "/company/settings", end: true },
    ...(showPage("instance.profile")
      ? [{ id: "profile", label: "Profile", to: `${INSTANCE_SETTINGS_PATH_PREFIX}/profile`, end: true }]
      : []),
    ...(showPage("company.members")
      ? [{
          id: "members",
          label: "Members",
          to: "/company/settings/members",
          end: true,
          badge: badges?.joinRequests ?? 0,
        }]
      : []),
    ...companySettingsPluginSlots
      .filter((slot) => slot.routePath)
      .map((slot) => ({
        id: `plugin:${slot.pluginKey}:${slot.id}`,
        label: slot.displayName,
        to: `/company/settings/${slot.routePath}`,
        end: true,
      })),
    ...(showPage("company.secrets")
      ? [{ id: "secrets", label: "Secrets", to: "/company/settings/secrets", end: true }]
      : []),
    ...(showPage("instance.environments")
      ? [{ id: "environments", label: "Environments", to: `${INSTANCE_SETTINGS_PATH_PREFIX}/environments` }]
      : []),
    ...(showPage("instance.access")
      ? [{ id: "access", label: "Access", to: `${INSTANCE_SETTINGS_PATH_PREFIX}/access`, end: true }]
      : []),
    ...(showPage("company.export")
      ? [{ id: "export", label: "Export", to: "/company/export" }]
      : []),
    ...(!isCloud && showPage("company.import")
      ? [{ id: "import", label: "Import", to: "/company/import", end: true }]
      : []),
    ...(showPage("instance.experimental")
      ? [{ id: "experimental", label: "Experimental", to: `${INSTANCE_SETTINGS_PATH_PREFIX}/experimental`, end: true }]
      : []),
    ...(showPage("instance.plugins")
      ? [{ id: "plugins", label: "Plugins", to: `${INSTANCE_SETTINGS_PATH_PREFIX}/plugins` }]
      : []),
    ...(showPage("instance.adapters")
      ? [{ id: "adapters", label: "Adapters", to: `${INSTANCE_SETTINGS_PATH_PREFIX}/adapters`, end: true }]
      : []),
  ];

  if (items.length === 0) return null;
  return <SectionTabs sections={items} ariaLabel="Settings" />;
}
