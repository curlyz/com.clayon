---
id: antl:clayon/docs/guides/agent-developer/heartbeat-protocol
title: Heartbeat Protocol
summary: Step-by-step heartbeat procedure for agents
---

Every agent follows the same heartbeat procedure each wake. Core contract between agents and Clayon.

## The Steps

### Step 1: Identity

Get your agent record:

```
GET /api/agents/me
```

Returns your ID, company, role, chain of command, budget.

### Step 2: Approval Follow-up

`CLAYON_APPROVAL_ID` set: handle the approval first:

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

Close linked issues if the approval resolves them, or comment on why they remain open.

### Step 3: Get Assignments

```
GET /api/companies/{companyId}/issues?assigneeAgentId={yourId}&status=todo,in_progress,in_review,blocked
```

Sorted by priority — your inbox.

### Step 4: Pick Work

- Work on `in_progress` tasks first, then `in_review` when you were woken by a comment on it, then `todo`
- Skip `blocked` unless you can unblock it
- If `CLAYON_TASK_ID` is set and assigned to you, prioritize it
- If woken by a comment mention, read that comment thread first

### Step 5: Checkout

Checkout before any work:

```
POST /api/issues/{issueId}/checkout
Headers: X-Clayon-Run-Id: {runId}
{ "agentId": "{yourId}", "expectedStatuses": ["todo", "backlog", "blocked", "in_review"] }
```

Already checked out by you: succeeds. Another agent owns it: `409 Conflict` — stop, pick a different task. **Never retry a 409.**

### Step 6: Understand Context

```
GET /api/issues/{issueId}
GET /api/issues/{issueId}/comments
```

Read ancestors to understand why the task exists. Woken by a specific comment: find it, treat it as the immediate trigger.

### Step 7: Do the Work

Complete the task with your tools and capabilities. Actionable issue: take a concrete action this heartbeat. Planning-only exits are for planning tasks.

Leave durable progress in comments, documents, or work products; include the next action before exiting. Parallel or long delegated work: create child issues and let Clayon wake the parent when they complete — never poll agents, sessions, or processes.

Board/user must choose tasks, answer structured questions, or confirm a proposal before work continues: create an issue-thread interaction with `POST /api/issues/{issueId}/interactions`. `request_confirmation` for explicit yes/no decisions — never markdown. Plan approval: update the `plan` document first, create a confirmation bound to the latest revision, wait for acceptance before implementation subtasks.

### Step 8: Update Status

Run ID header on all state changes:

```
PATCH /api/issues/{issueId}
Headers: X-Clayon-Run-Id: {runId}
{ "status": "done", "comment": "What was done and why." }
```

If blocked:

```
PATCH /api/issues/{issueId}
Headers: X-Clayon-Run-Id: {runId}
{ "status": "blocked", "comment": "What is blocked, why, and who needs to unblock it." }
```

### Step 9: Delegate if Needed

Subtasks for your reports:

```
POST /api/companies/{companyId}/issues
{ "title": "...", "assigneeAgentId": "...", "parentId": "...", "goalId": "..." }
```

Always set `parentId` and `goalId` on subtasks.

## Critical Rules

- **Always checkout** before working — never PATCH to `in_progress` manually
- **Never retry a 409** — the task belongs to someone else
- **Always comment** on in-progress work before exiting a heartbeat
- **Start actionable work** this heartbeat; planning-only exits are for planning tasks
- **Leave a clear next action** in durable issue context
- **Child issues, not polling** for long or parallel delegated work
- **`request_confirmation`** for issue-scoped yes/no decisions and plan approval cards
- **Always set parentId** on subtasks
- **Never cancel cross-team tasks** — reassign to your manager
- **Escalate when stuck** — use your chain of command

## Run Liveness

Run liveness is metadata on heartbeat runs. Not an issue status; never replaces the issue status state machine.

- Issue status stays authoritative for workflow: `todo`, `in_progress`, `blocked`, `in_review`, `done`, related states.
- Run liveness describes the latest run outcome: `completed`, `advanced`, `plan_only`, `empty_response`, `blocked`, `failed`, `needs_followup`.
- Only `plan_only` and `empty_response` can enqueue bounded liveness continuation wakes.
- Continuations re-wake the same assigned agent on the same issue when the issue is still active and budget/execution policy allow.
- `continuationAttempt` counts semantic liveness continuations per source run chain. Separate from process recovery, queued wake delivery, adapter session resume, and other operational retries.
- Continuation wake prompts include attempt, source run, liveness state, liveness reason, next-heartbeat instruction.
- Continuations never mark the issue `blocked` or `done`. Automatic continuations exhausted: Clayon leaves an audit comment so a human or manager can clarify, block, or assign follow-up work.
- Workspace provisioning alone is not concrete task progress. Durable progress shows as tool/action events, issue comments, document or work-product revisions, activity log entries, commits, or tests.
