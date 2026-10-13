import type { PluginPageProps, PluginSidebarProps } from "@clayon/plugin-sdk/ui";
import { useHostNavigation, usePluginData } from "@clayon/plugin-sdk/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChangeDetail, ChangeSummary, Repository } from "../contracts.js";

const PAGE_ROUTE = "code-changes";
const POLL_INTERVAL_MILLISECONDS = 2_000;
const CHANGE_LIMIT = 100;

const HAIRLINE = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const MUTED: CSSProperties = { opacity: 0.6 };
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const STATUS_COLOR: Record<ChangeSummary["status"], string> = {
  added: "#2e9d5b",
  modified: "#c58a1b",
  deleted: "#d1453b",
  renamed: "#3b82d1",
  reverted: "#8a8a8a",
};

// Convex has no push channel through the plugin bridge yet, so the page re-reads every two
// seconds while visible. Events reach Convex in real time; this is the display delay.
function usePolling(refresh: () => void): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const handle = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshRef.current();
    }, POLL_INTERVAL_MILLISECONDS);
    return () => window.clearInterval(handle);
  }, []);
}

function formatAge(occurredAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - occurredAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function lineColor(line: string): string | undefined {
  if (line.startsWith("+") && !line.startsWith("+++")) return "#2e9d5b";
  if (line.startsWith("-") && !line.startsWith("---")) return "#d1453b";
  if (line.startsWith("@@")) return "#3b82d1";
  return undefined;
}

function PatchView({ companyId, changeId }: { companyId: string; changeId: string }) {
  const change = usePluginData<ChangeDetail | null>("change", { companyId, changeId });
  if (change.loading && change.data === null) return <div style={MUTED}>Loading patch</div>;
  if (change.error) return <div style={{ color: "#d1453b" }}>{change.error.message}</div>;
  if (change.data === null) return <div style={MUTED}>This change was already pruned.</div>;
  const { patch, isPatchTruncated } = change.data;
  return (
    <div>
      <pre
        style={{
          margin: 0,
          padding: "8px 12px",
          overflowX: "auto",
          fontFamily: MONO,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {patch.split("\n").map((line, index) => (
          <div key={index} style={{ color: lineColor(line) }}>
            {line || " "}
          </div>
        ))}
      </pre>
      {isPatchTruncated ? <div style={{ ...MUTED, padding: "0 12px 8px" }}>Patch truncated at 200,000 characters.</div> : null}
    </div>
  );
}

function ChangeRow({ change, companyId, now }: { change: ChangeSummary; companyId: string; now: number }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ borderBottom: HAIRLINE }}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        style={{
          display: "grid",
          gridTemplateColumns: "76px 1fr auto auto",
          gap: 12,
          alignItems: "baseline",
          width: "100%",
          padding: "8px 12px",
          textAlign: "left",
          background: "transparent",
          color: "inherit",
          border: 0,
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span style={{ color: STATUS_COLOR[change.status], fontSize: 12, fontWeight: 600 }}>{change.status}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, overflowWrap: "anywhere" }}>
          {change.filePath}
          <span style={{ ...MUTED, fontFamily: "inherit", marginLeft: 8 }}>
            {change.repositoryLabel}
            {change.changeKind === "committed" && change.commitMessage ? ` · commit: ${change.commitMessage}` : ""}
          </span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12 }}>
          <span style={{ color: "#2e9d5b" }}>+{change.additions}</span>{" "}
          <span style={{ color: "#d1453b" }}>-{change.deletions}</span>
        </span>
        <span style={{ ...MUTED, fontSize: 12 }}>{formatAge(change.occurredAt, now)}</span>
      </button>
      {isOpen ? <PatchView companyId={companyId} changeId={change._id} /> : null}
    </div>
  );
}

export function CodeChangesPage({ context }: PluginPageProps) {
  const companyId = context.companyId ?? "";
  const [repositoryPath, setRepositoryPath] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const changes = usePluginData<ChangeSummary[]>("code-changes", {
    companyId,
    limit: CHANGE_LIMIT,
    repositoryPath: repositoryPath || undefined,
  });
  const repositories = usePluginData<Repository[]>("repositories", { companyId });
  usePolling(() => {
    changes.refresh();
    repositories.refresh();
    setNow(Date.now());
  });

  if (!companyId) return <div style={{ padding: 16, ...MUTED }}>Select a company to see code changes.</div>;
  if (changes.error) {
    return (
      <div style={{ padding: 16 }}>
        <strong>Code Changes</strong>
        <p style={{ color: "#d1453b" }}>{changes.error.message}</p>
        <p style={MUTED}>Check the plugin settings: Convex URL and read token.</p>
      </div>
    );
  }

  const repositoryList = repositories.data ?? [];
  const quarantined = repositoryList.filter((repository) => repository.state === "quarantined");
  const rows = changes.data ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderBottom: HAIRLINE }}>
        <strong style={{ fontSize: 15 }}>Code Changes</strong>
        <span style={{ ...MUTED, fontSize: 12 }}>live, refreshed every {POLL_INTERVAL_MILLISECONDS / 1000}s</span>
        <select
          value={repositoryPath}
          onChange={(event) => setRepositoryPath(event.target.value)}
          aria-label="Repository"
          style={{ marginLeft: "auto", font: "inherit", padding: "4px 8px" }}
        >
          <option value="">All repositories</option>
          {repositoryList.map((repository) => (
            <option key={repository._id} value={repository.repositoryPath}>
              {repository.repositoryLabel}
            </option>
          ))}
        </select>
      </div>
      {quarantined.map((repository) => (
        <div key={repository._id} style={{ padding: "8px 12px", borderBottom: HAIRLINE, color: "#c58a1b", fontSize: 12 }}>
          Skipping {repository.repositoryLabel}: {repository.message ?? "unreadable"}
        </div>
      ))}
      {rows.length === 0 ? (
        <div style={{ padding: 16, ...MUTED }}>
          {changes.loading ? "Loading" : "No changes yet. Run `cngkit git watch --convex` in a repository."}
        </div>
      ) : (
        rows.map((change) => <ChangeRow key={change._id} change={change} companyId={companyId} now={now} />)
      )}
    </div>
  );
}

export function CodeChangesSidebarLink(_props: PluginSidebarProps) {
  const hostNavigation = useHostNavigation();
  const href = hostNavigation.resolveHref(`/${PAGE_ROUTE}`);
  const isActive = window.location.pathname === href;
  return (
    <a
      {...hostNavigation.linkProps(`/${PAGE_ROUTE}`)}
      aria-current={isActive ? "page" : undefined}
      className={[
        "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors",
        isActive ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M6 8v8" />
        <path d="M8 6h4a4 4 0 0 1 4 4v0" />
      </svg>
      <span className="truncate">Code Changes</span>
    </a>
  );
}
