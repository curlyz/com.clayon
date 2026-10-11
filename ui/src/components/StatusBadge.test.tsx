// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentStatusBadge, IssueStatusBadge, StatusBadge } from "./StatusBadge";
import { taskStatusVar } from "../lib/status-colors";

/** --status-task-* base hue → the --sc setter class that points --sc at it. */
const scClassByVar: Record<string, string> = {
  "--status-task-backlog": "status-sc-task-backlog",
  "--status-task-todo": "status-sc-task-todo",
  "--status-task-in_progress": "status-sc-task-in_progress",
  "--status-task-in_review": "status-sc-task-in_review",
  "--status-task-done": "status-sc-task-done",
  "--status-task-blocked": "status-sc-task-blocked",
  "--status-task-cancelled": "status-sc-task-cancelled",
};

/**
 * Issue/task status chips carry the unified glyph and are recolored from the
 * `--status-task-*` base hue via the --sc setter classes.
 */
describe("IssueStatusBadge", () => {
  it("wires each issue status to its --status-task-* base hue, with a glyph", () => {
    for (const [status, cssVar] of Object.entries(taskStatusVar)) {
      const html = renderToStaticMarkup(<IssueStatusBadge status={status} />);
      expect(html).toContain("status-chip");
      expect(html).toContain("border");
      expect(html).toContain(scClassByVar[cssVar] ?? "");
      expect(html).toContain('viewBox="0 0 24 24"'); // unified glyph
    }
  });

  it("points in_progress at the blue liveness class and todo at the amber class", () => {
    expect(renderToStaticMarkup(<IssueStatusBadge status="in_progress" />)).toContain("status-sc-task-in_progress");
    expect(renderToStaticMarkup(<IssueStatusBadge status="todo" />)).toContain("status-sc-task-todo");
  });

  it("sentence-cases the label and uses regular weight", () => {
    const html = renderToStaticMarkup(<IssueStatusBadge status="in_review" />);
    expect(html).toContain("In review");
    expect(html).not.toContain("In Review"); // sentence case, not title case
    expect(html).toContain("font-normal");
    expect(html).not.toContain("font-medium");
  });

  it("strikes through cancelled chips", () => {
    expect(renderToStaticMarkup(<IssueStatusBadge status="cancelled" />)).toContain("line-through");
  });

  it("falls back to the backlog (gray) class for unknown statuses", () => {
    expect(renderToStaticMarkup(<IssueStatusBadge status="mystery" />)).toContain("status-sc-task-backlog");
  });

  it("renders task chips without depending on the chat flag", () => {
    const html = renderToStaticMarkup(<IssueStatusBadge status="todo" />);
    expect(html).toContain("status-chip");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain("Todo");
  });
});

/** Agent status renders as colored text from the `--status-agent-*` hues. */
describe("AgentStatusBadge", () => {
  it("wires each agent status to its --status-agent-* text utility class", () => {
    const textClassByStatus: Record<string, string> = {
      idle: "text-status-idle",
      active: "text-status-idle",
      running: "text-status-running",
      paused: "text-status-paused",
      error: "text-status-error",
    };
    for (const [status, textClass] of Object.entries(textClassByStatus)) {
      const html = renderToStaticMarkup(<AgentStatusBadge status={status} />);
      expect(html).toContain(textClass);
      expect(html).toContain("font-medium");
      expect(html).not.toContain("status-chip");
      expect(html).not.toContain("rounded-full");
      expect(html).not.toContain("border");
    }
  });

  it('renders "active" as the idle label', () => {
    expect(renderToStaticMarkup(<AgentStatusBadge status="active" />)).toContain("idle");
  });
});

describe("StatusBadge", () => {
  it("renders colored text only, from the text-status-* token utilities", () => {
    expect(renderToStaticMarkup(<StatusBadge status="todo" />)).toContain("text-status-todo");
    expect(renderToStaticMarkup(<StatusBadge status="in_progress" />)).toContain("text-status-in-progress");
  });

  it("renders unknown and neutral statuses as muted text with no fill or border", () => {
    for (const status of ["mystery", "archived", "backlog", "idle"]) {
      const html = renderToStaticMarkup(<StatusBadge status={status} />);
      expect(html).toContain("text-muted-foreground");
      expect(html).toContain("font-medium");
      expect(html).not.toContain("bg-");
      expect(html).not.toContain("rounded-");
      expect(html).not.toContain("border");
    }
  });
});
