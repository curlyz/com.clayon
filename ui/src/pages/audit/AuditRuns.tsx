import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HeartbeatRun, RoutineRunSummary } from "@paperclipai/shared";
import { Activity, CircleDotDashed } from "lucide-react";
import { agentsApi } from "@/api/agents";
import { heartbeatsApi } from "@/api/heartbeats";
import { routinesApi } from "@/api/routines";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useSearchParams } from "@/lib/router";
import { relativeTime } from "@/lib/utils";

const ALL = "__all";
const RUN_LIMIT = 200;

function runSummary(run: HeartbeatRun) {
  const result = run.resultJson as { summary?: unknown; result?: unknown } | null;
  const value = result?.summary ?? result?.result ?? run.error;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function runDuration(run: HeartbeatRun) {
  const start = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : null;
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function readableSource(source: string) {
  return source.replaceAll("_", " ");
}

function routineRunTitle(run: RoutineRunSummary) {
  return run.linkedIssue?.title ?? run.trigger?.label ?? "Routine run";
}

function RoutineScopedRuns({
  runs,
  isLoading,
  error,
  onRetry,
}: {
  runs: RoutineRunSummary[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="border-t border-border px-4 py-14 text-center text-sm text-muted-foreground">
        Loading routine runs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 border-t border-border text-center">
        <p className="px-4 pt-14 text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  if (runs.length === 0) {
    return <EmptyState icon={Activity} message="No routine runs yet." />;
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50">
        <h2 className="px-4 py-3 text-lg font-semibold text-foreground">Routine runs</h2>
        <Badge variant="secondary">{runs.length}</Badge>
      </div>
      <p className="max-w-2xl px-4 py-3 text-sm text-muted-foreground">
        Executions created by this routine, newest first.
      </p>
      <ul className="grid gap-x-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Routine runs">
        {runs.map((run) => {
          const content = (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{routineRunTitle(run)}</span>
                  <StatusBadge status={run.status} />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {run.trigger?.label ?? readableSource(run.source)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="capitalize">{readableSource(run.source)}</span>
                <time dateTime={new Date(run.triggeredAt).toISOString()}>
                  {relativeTime(run.triggeredAt)}
                </time>
              </div>
            </>
          );
          const rowClassName = "flex h-full min-w-0 flex-col justify-between gap-3 px-4 py-3 text-inherit no-underline transition-colors hover:bg-muted/50";
          return (
            <li key={run.id} className="min-w-0 border-t border-border">
              {run.linkedIssue ? (
                <Link to={`/issues/${run.linkedIssue.identifier ?? run.linkedIssue.id}`} className={rowClassName}>
                  {content}
                </Link>
              ) : (
                <div className={rowClassName}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Showing the {RUN_LIMIT} most recent routine runs.</p>
    </div>
  );
}

export function AuditRuns({ companyId, routineId }: { companyId: string; routineId?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const agentId = searchParams.get("agentId") ?? ALL;
  const status = searchParams.get("runStatus") ?? ALL;
  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !routineId,
  });
  const runs = useQuery({
    queryKey: queryKeys.audit.runs(companyId, agentId === ALL ? null : agentId),
    queryFn: () =>
      heartbeatsApi.list(companyId, agentId === ALL ? undefined : agentId, RUN_LIMIT, {
        summary: true,
      }),
    refetchInterval: 15_000,
    enabled: !routineId,
  });
  const routineRuns = useQuery({
    queryKey: [...queryKeys.routines.runs(routineId ?? ""), "audit"],
    queryFn: () => routinesApi.listRuns(routineId!, RUN_LIMIT),
    enabled: Boolean(routineId),
    refetchInterval: 15_000,
  });
  const agentById = useMemo(
    () => new Map((agents.data ?? []).map((agent) => [agent.id, agent])),
    [agents.data],
  );
  const statuses = useMemo(
    () => Array.from(new Set((runs.data ?? []).map((run) => run.status))).sort(),
    [runs.data],
  );
  const visibleRuns = useMemo(
    () => (runs.data ?? []).filter((run) => status === ALL || run.status === status),
    [runs.data, status],
  );

  const updateFilter = (key: "agentId" | "runStatus", value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === ALL) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const clearFilters = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("agentId");
        next.delete("runStatus");
        return next;
      },
      { replace: true },
    );
  };

  if (routineId) {
    return (
      <RoutineScopedRuns
        runs={routineRuns.data ?? []}
        isLoading={routineRuns.isLoading}
        error={routineRuns.error instanceof Error ? routineRuns.error : null}
        onRetry={() => void routineRuns.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50">
        <h2 className="px-4 py-3 text-lg font-semibold text-foreground">Runs</h2>
        <Badge variant="secondary">{visibleRuns.length}</Badge>
      </div>
      <p className="max-w-2xl px-4 py-3 text-sm text-muted-foreground">
        Recent agent executions across the organization. Open a run to inspect its transcript,
        output, and task context.
      </p>

      <div className="flex flex-wrap items-end gap-3 border-t border-border bg-muted/50">
        <label className="grid gap-1 text-(length:--text-micro) font-medium text-muted-foreground">
          <span className="px-3 pt-3">Agent</span>
          <Select value={agentId} onValueChange={(value) => updateFilter("agentId", value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All agents</SelectItem>
              {(agents.data ?? []).map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-(length:--text-micro) font-medium text-muted-foreground">
          <span className="px-3 pt-3">Status</span>
          <Select value={status} onValueChange={(value) => updateFilter("runStatus", value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {statuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {readableSource(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {agentId !== ALL || status !== ALL ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {runs.isLoading ? (
        <div className="border-t border-border px-4 py-14 text-center text-sm text-muted-foreground">
          Loading runs…
        </div>
      ) : runs.error ? (
        <div className="flex flex-col items-center gap-3 border-t border-border text-center">
          <p className="px-4 pt-14 text-sm text-muted-foreground">
            {runs.error instanceof Error ? runs.error.message : "Failed to load runs."}
          </p>
          <Button variant="outline" size="sm" onClick={() => runs.refetch()}>
            Try again
          </Button>
        </div>
      ) : visibleRuns.length === 0 ? (
        <EmptyState
          icon={agentId !== ALL || status !== ALL ? CircleDotDashed : Activity}
          message={agentId !== ALL || status !== ALL ? "No runs match these filters." : "No runs yet."}
        />
      ) : (
        <ul className="grid gap-x-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Recent runs">
          {visibleRuns.map((run) => {
            const agent = agentById.get(run.agentId);
            const summary = runSummary(run);
            const duration = runDuration(run);
            return (
              <li key={run.id} className="min-w-0 border-t border-border">
                <Link
                  to={`/agents/${run.agentId}/runs/${run.id}`}
                  className="flex h-full min-w-0 flex-col justify-between gap-3 px-4 py-3 text-inherit no-underline transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {agent?.name ?? "Unknown agent"}
                      </span>
                      <span className="font-mono text-(length:--text-micro) text-muted-foreground">
                        {run.id.slice(0, 8)}
                      </span>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {summary ?? `${readableSource(run.invocationSource)} run`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span className="capitalize">{readableSource(run.invocationSource)}</span>
                    {duration ? <span>{duration}</span> : null}
                    <time dateTime={new Date(run.createdAt).toISOString()}>
                      {relativeTime(run.createdAt)}
                    </time>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Showing the {RUN_LIMIT} most recent runs.</p>
    </div>
  );
}
