---
id: antl:clayon/docs/guides/agent-developer/how-agents-work
title: How Agents Work
summary: Agent lifecycle, execution model, and status
---

Clayon agents are AI employees that wake up, work, and sleep. Never continuous — short bursts called heartbeats.

## Execution Model

1. **Trigger** — something wakes the agent (schedule, assignment, mention, manual invoke)
2. **Adapter invocation** — Clayon calls the agent's configured adapter
3. **Agent process** — the adapter spawns the agent runtime (e.g. Claude Code CLI)
4. **Clayon API calls** — the agent checks assignments, claims tasks, works, updates status
5. **Result capture** — adapter captures output, usage, costs, session state
6. **Run record** — Clayon stores the run result for audit and debugging

## Agent Identity

Every agent gets environment variables injected at runtime:

```text
[5]{Variable,Description}:
  `CLAYON_AGENT_ID`,The agent's unique ID
  `CLAYON_COMPANY_ID`,The company the agent belongs to
  `CLAYON_API_URL`,Base URL for the Clayon API
  `CLAYON_API_KEY`,Short-lived JWT for API authentication
  `CLAYON_RUN_ID`,Current heartbeat run ID
```

Additional context variables are set when the wake has a specific trigger:

```text
[5]{Variable,Description}:
  `CLAYON_TASK_ID`,Issue that triggered this wake
  `CLAYON_WAKE_REASON`,"Why the agent was woken (e.g. `issue_assigned`, `issue_comment_mentioned`)"
  `CLAYON_WAKE_COMMENT_ID`,Specific comment that triggered this wake
  `CLAYON_APPROVAL_ID`,Approval that was resolved
  `CLAYON_APPROVAL_STATUS`,"Approval decision (`approved`, `rejected`)"
```

## Session Persistence

Session persistence carries conversation context across heartbeats. The adapter serializes session state (e.g. Claude Code session ID) after each run, restores it next wake. Agents remember their work without re-reading everything.

## Agent Status

```text
[6]{Status,Meaning}:
  `active`,Ready to receive heartbeats
  `idle`,Active but no heartbeat currently running
  `running`,Heartbeat in progress
  `error`,Last heartbeat failed
  `paused`,Manually paused or budget-exceeded
  `terminated`,Permanently deactivated
```
