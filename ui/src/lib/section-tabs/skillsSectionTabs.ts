import { GithubIcon } from "@/components/icons/github-icon";
import { Compass, Library, PencilRuler, type LucideIcon } from "lucide-react";

export type SkillsSectionTab = {
  /** Section band id on the /skills long page; doubles as the `#<id>` hash anchor. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Dedicated See-more route showing this section's view alone. */
  to: string;
  group?: string;
};

/**
 * One entry per section band on the /skills long page. ids, labels and icons
 * copy the view nav from SkillsContextualSidebar (installed / discover /
 * sources / authored) so the page tab strip and the sidebar nested sub-nav
 * render the same section list (ADDENDUM 2/3 single-source rule). SectionTabs
 * anchors on `#` + id; `to` is the deep-link route each band's "See more"
 * opens.
 */
export const SKILLS_SECTION_TABS: readonly SkillsSectionTab[] = [
  { id: "installed", label: "Installed", icon: Library, to: "/skills?tab=installed" },
  { id: "discover", label: "Discover", icon: Compass, to: "/skills?tab=discover" },
  { id: "sources", label: "Sources", icon: GithubIcon, to: "/skills/sources" },
  { id: "authored", label: "My Skills", icon: PencilRuler, to: "/skills/studio", group: "Author" },
];
