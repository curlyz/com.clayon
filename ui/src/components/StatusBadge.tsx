import { cn } from "../lib/utils";
import { agentStatusMotion } from "../lib/status-colors";
import { StatusGlyph } from "./StatusGlyph";

/**
 * Status → token utility class (text color). The `text-status-*` utilities
 * are generated in index.css's @theme block from the existing `--status-*`
 * base hues, so the components pick a class and never set an inline custom
 * property. Statuses with no entry render as neutral muted text; values
 * follow the hue families the old chip recipes used (green done / red
 * blocked / amber todo / blue liveness / violet review).
 */
const statusTextClass: Record<string, string> = {
  // green family
  achieved: "text-status-done",
  completed: "text-status-done",
  succeeded: "text-status-done",
  ok: "text-status-done",
  approved: "text-status-done",
  done: "text-status-done",
  allowed: "text-status-done",
  healthy: "text-status-done",
  // red family
  failed: "text-status-blocked",
  error: "text-status-blocked",
  rejected: "text-status-blocked",
  blocked: "text-status-blocked",
  denied: "text-status-blocked",
  block: "text-status-blocked",
  terminated: "text-status-blocked",
  quarantined: "text-status-blocked",
  "runtime-error": "text-status-blocked",
  // amber family
  paused: "text-status-todo",
  todo: "text-status-todo",
  pending: "text-status-todo",
  queued: "text-status-todo",
  pending_approval: "text-status-todo",
  revision_requested: "text-status-todo",
  "require-approval": "text-status-todo",
  degraded: "text-status-todo",
  warning: "text-status-todo",
  timed_out: "text-status-todo",
  "rate-limit": "text-status-todo",
  // blue family (liveness)
  running: "text-status-in-progress",
  in_progress: "text-status-in-progress",
  scheduled_retry: "text-status-in-progress",
  info: "text-status-in-progress",
  deferred: "text-status-in-progress",
  // violet family
  in_review: "text-status-in-review",
  redacted: "text-status-in-review",
};

/** Agent status → text utility class from the `--status-agent-*` hues. */
const agentStatusTextClass: Record<string, string> = {
  idle: "text-status-idle",
  active: "text-status-idle",
  running: "text-status-running",
  paused: "text-status-paused",
  error: "text-status-error",
};

/** Agent status → `--sc` setter class (`.status-fill` reads `--sc`). */
const agentStatusScClass: Record<string, string> = {
  idle: "status-sc-agent-idle",
  active: "status-sc-agent-idle",
  running: "status-sc-agent-running",
  paused: "status-sc-agent-paused",
  error: "status-sc-agent-error",
};

/** Task/issue status → `--sc` setter class (`.status-chip` reads `--sc`). */
const taskStatusScClass: Record<string, string> = {
  idle: "status-sc-task-backlog",
  backlog: "status-sc-task-backlog",
  todo: "status-sc-task-todo",
  in_progress: "status-sc-task-in_progress",
  in_review: "status-sc-task-in_review",
  done: "status-sc-task-done",
  blocked: "status-sc-task-blocked",
  cancelled: "status-sc-task-cancelled",
};

/** The single status-label rule: underscores/dashes read as spaces. */
function statusLabel(status: string): string {
  return status.replace(/[_-]/g, " ");
}

/** "in_review" → "In review" (sentence case over {@link statusLabel}). */
function sentenceCaseStatus(status: string): string {
  const s = statusLabel(status);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generic status badge for runs / goals / approvals (not task status).
 * Colored text only (operator directive): color from the `text-status-*`
 * token utilities, no pill, no fill, no border; neutral statuses fall back
 * to muted foreground.
 */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium whitespace-nowrap shrink-0",
        statusTextClass[status] ?? "text-muted-foreground",
      )}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}

/**
 * Agent status — colored text only (operator directive), recolored from the
 * `--status-agent-*` base hues through the `text-status-*` utilities.
 * `active` renders as "idle" (the palette layer maps it to the idle hue;
 * fixtures and older rows still carry the value).
 */
export function AgentStatusBadge({ status }: { status: string }) {
  const label = status === "active" ? "idle" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium leading-none whitespace-nowrap shrink-0",
        agentStatusTextClass[status] ?? agentStatusTextClass.idle,
      )}
    >
      {statusLabel(label)}
    </span>
  );
}

/**
 * Agent status indicator — heartbeat capsule (vertical 8x16, r4) filled from the
 * `--status-agent-*` base hue via the `--sc` setter classes. Running agents
 * pulse, broken (error) agents blink; both honor `prefers-reduced-motion`.
 */
export function AgentStatusCapsule({ status }: { status: string }) {
  const motion = agentStatusMotion[status] ?? "";
  return (
    <span
      aria-hidden
      className={cn(
        "status-fill inline-block h-4 w-2 rounded-(--rad-4) shrink-0",
        agentStatusScClass[status] ?? agentStatusScClass.idle,
        motion,
      )}
    />
  );
}

/**
 * Issue/task status — colored text carrying the unified {@link StatusGlyph}
 * (one distinct, color-blind-safe shape per status, kept for information),
 * recolored from the `--status-task-*` base hue through the `--sc` setter
 * classes, a sentence-cased label and regular weight. `cancelled` is struck
 * through. Distinct from the generic {@link StatusBadge} so run/goal/approval
 * badges are unaffected.
 */
export function IssueStatusBadge({ status: taskStatus, externalConversationState }: { status: string; externalConversationState?: "active" | "waiting" | null }) {
  const status = taskStatus === "in_review" && externalConversationState === "waiting" ? "idle" : taskStatus;
  return (
    <span
      className={cn(
        "status-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-normal leading-none whitespace-nowrap shrink-0",
        taskStatusScClass[status] ?? taskStatusScClass.backlog,
        status === "cancelled" && "line-through",
      )}
    >
      <StatusGlyph status={status} size="sm" />
      {sentenceCaseStatus(status)}
    </span>
  );
}
