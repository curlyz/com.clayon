import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  BookOpenText,
  History,
  KeyRound,
  Library,
  MessageSquare,
  PlayCircle,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { agentDetailHref, agentScopedAuditHref } from "@/pages/agent-detail-navigation";

/**
 * Single source of truth for the agent surface's section list. Consumed by
 * BOTH navigation surfaces (the page's sticky SectionTabs strip and the
 * sidebar layout's nested sub-nav) — copy ids/labels/icons derive from the
 * retired AgentContextualSidebar navigation (addendum 3 of the redesign
 * brief). `id` doubles as the long page's band element id and hash anchor.
 */
export type SectionTab = {
  /** Band element id and hash anchor (`#<id>`). */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Dedicated route the band's "See more" link opens. */
  to: string;
  /** Group label rendered as plain text in tab strips and sub-nav. */
  group: string;
};

export function buildAgentSectionTabs(agentRef: string, agentId: string): SectionTab[] {
  return [
    { id: "overview", label: "Overview", icon: Sparkles, group: "Agent", to: agentDetailHref(agentRef, "overview") },
    { id: "instructions", label: "Instructions", icon: BookOpenText, group: "Agent", to: agentDetailHref(agentRef, "instructions") },
    { id: "skills", label: "Skills", icon: Library, group: "Agent", to: agentDetailHref(agentRef, "skills") },
    { id: "runtime", label: "Harness / Runtime", icon: Settings2, group: "Runtime", to: agentDetailHref(agentRef, "runtime") },
    { id: "secrets", label: "Secrets & variables", icon: ShieldCheck, group: "Runtime", to: agentDetailHref(agentRef, "secrets") },
    { id: "tools", label: "Tools", icon: Wrench, group: "Runtime", to: agentDetailHref(agentRef, "tools") },
    { id: "channels", label: "Channels", icon: MessageSquare, group: "Runtime", to: agentDetailHref(agentRef, "channels") },
    { id: "permissions", label: "Permissions / Trust", icon: ShieldCheck, group: "Governance", to: agentDetailHref(agentRef, "permissions") },
    { id: "api-keys", label: "API Keys", icon: KeyRound, group: "Governance", to: agentDetailHref(agentRef, "api-keys") },
    { id: "revisions", label: "Revisions", icon: History, group: "Governance", to: agentDetailHref(agentRef, "revisions") },
    { id: "activity", label: "Activity", icon: Activity, group: "Audit", to: agentScopedAuditHref(agentId, "activity") },
    { id: "runs", label: "Runs", icon: PlayCircle, group: "Audit", to: agentScopedAuditHref(agentId, "runs") },
    { id: "costs", label: "Costs", icon: ReceiptText, group: "Audit", to: agentScopedAuditHref(agentId, "costs") },
    { id: "budgets", label: "Budgets", icon: BadgeDollarSign, group: "Audit", to: agentScopedAuditHref(agentId, "budgets") },
  ];
}
