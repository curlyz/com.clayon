import { DEVELOPER_TABS, advancedTabHref, isExperimentalToolTab } from "@/pages/tools/tool-tabs";
import { useSmokeLabEnabled } from "@/hooks/useSmokeLabEnabled";
import { useReviewCount } from "@/pages/apps/useReviewCount";
import { SectionTabs, type SectionTabsItem } from "./SectionTabs";

/**
 * Page tabs for the connectors surface (operator: /ANA/apps uses page tabs,
 * not a sub sidebar). Same entries and filters the Apps sidebar had: Browse,
 * Review (with its waiting count), and the developer tabs behind their
 * feature gates. Per-connection pages carry their own tab strip
 * (AppDetailPageTabs).
 */
export function AppsPageTabs() {
  const reviewCount = useReviewCount();
  const { enabled: smokeLabEnabled } = useSmokeLabEnabled();
  const developerTabs = DEVELOPER_TABS.filter((tab) => {
    // Temporarily hide Gateways and Profiles until they are ready to ship.
    // Keep their tab definitions and routes intact so we can bring them back later.
    if (tab.key === "gateways" || tab.key === "profiles") return false;
    return !isExperimentalToolTab(tab.key) || smokeLabEnabled;
  });

  const items: SectionTabsItem[] = [
    { id: "browse", label: "Browse", to: "/apps", end: true },
    {
      id: "review",
      label: "Review",
      to: "/apps/review",
      end: true,
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    ...developerTabs.map((tab) => ({
      id: `developer:${tab.key}`,
      label: tab.label,
      to: advancedTabHref(tab.key),
      end: true,
      group: "Developer",
    })),
  ];

  return <SectionTabs sections={items} ariaLabel="Connectors" />;
}
