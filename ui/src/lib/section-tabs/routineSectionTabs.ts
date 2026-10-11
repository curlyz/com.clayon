import {
  Activity,
  Braces,
  CalendarClock,
  KeyRound,
  LayoutDashboard,
  Play,
  Send,
  type LucideIcon,
} from "lucide-react";
import { routineDetailHref } from "../routine-navigation";

export type RoutineSectionTab = {
  /** Section band id on the routine detail long page; doubles as the `#<id>` hash anchor. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Dedicated See-more route showing this section alone. */
  to: string;
  group?: string;
};

/**
 * One entry per section band on the routine detail long page — the same
 * section list the page tab strip and the sidebar nested sub-nav render
 * (ADDENDUM 2/3 single-source rule). Built per routine because `to` carries
 * the routine id; SectionTabs anchors on `#` + id.
 */
export function buildRoutineSectionTabs(routineId: string): RoutineSectionTab[] {
  return [
    { id: "overview", label: "Overview", icon: LayoutDashboard, to: routineDetailHref(routineId, "overview") },
    { id: "triggers", label: "Triggers", icon: CalendarClock, to: routineDetailHref(routineId, "triggers") },
    { id: "variables", label: "Variables", icon: Braces, to: routineDetailHref(routineId, "variables") },
    { id: "delivery", label: "Delivery", icon: Send, to: routineDetailHref(routineId, "delivery") },
    { id: "secrets", label: "Secrets", icon: KeyRound, to: routineDetailHref(routineId, "secrets") },
    { id: "runs", label: "Runs", icon: Play, to: routineDetailHref(routineId, "runs"), group: "Operate" },
    { id: "activity", label: "Activity", icon: Activity, to: routineDetailHref(routineId, "activity"), group: "Operate" },
  ];
}
