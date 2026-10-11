import { useQuery } from "@tanstack/react-query";
import { aiConnectionRouterPluginKey, type ToolConnection } from "@clayon/shared";
import { toolsApi } from "@/api/tools";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { APP_TABS, appApplicationTabHref, appTabHref } from "@/pages/apps/app-tabs";
import { SectionTabs, type SectionTabsItem } from "./SectionTabs";

/**
 * Page tabs for a connector detail (operator: /ANA/apps uses page tabs, not a
 * sub sidebar). Permissions and Review are separate routes; an AI connection
 * pool keeps only its Settings entry, and a single tab renders no strip.
 */
export function AppDetailPageTabs({
  connection,
  applicationId,
}: {
  connection?: ToolConnection;
  applicationId?: string;
}) {
  const { selectedCompanyId } = useCompany();
  const poolPluginKey = connection ? aiConnectionRouterPluginKey(connection) : null;
  const attentionQuery = useQuery({
    queryKey: queryKeys.apps.attention(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listAppsAttention(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });
  const attentionItem = connection
    ? attentionQuery.data?.apps.find((app) => app.connection.id === connection.id)
    : null;
  const reviewCount =
    (attentionItem?.pendingActionRequestCount ?? 0) +
    ((attentionItem?.quarantinedCatalogEntryCount ?? 0) > 0 ? 1 : 0);

  const items: SectionTabsItem[] = APP_TABS
    .filter((tab) => !poolPluginKey || tab.key === "permissions")
    .map((tab) => ({
      id: tab.key,
      label: poolPluginKey ? "Settings" : tab.label,
      to: applicationId
        ? appApplicationTabHref(applicationId, tab.key)
        : connection
          ? appTabHref(connection.id, tab.key)
          : "/apps",
      end: true,
      badge: tab.key === "review" && reviewCount > 0 ? reviewCount : undefined,
    }));

  if (items.length < 2) return null;
  return <SectionTabs sections={items} ariaLabel="Connector" />;
}
