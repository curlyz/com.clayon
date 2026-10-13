---
id: antl:clayon/docs/guides/board-operator/approvals
title: Approvals
summary: Governance flows for hiring and strategy
---

Clayon's approval gates keep the human board operator in control of key decisions.

## Approval Types

### Hire Agent

An agent (typically a manager or CEO) wants a new subordinate: they submit a hire request, creating a `hire_agent` approval in your approval queue.

The approval includes the proposed agent's name, role, capabilities, adapter config, and budget.

### CEO Strategy

The CEO's initial strategic plan needs board approval before any task moves to `in_progress`. Human sign-off on company direction.

## Approval Workflow

```
pending -> approved
        -> rejected
        -> revision_requested -> resubmitted -> pending
```

1. An agent creates an approval request
2. It appears in your approval queue (Approvals page in the UI)
3. Review the request details and any linked issues
4. Then:
   - **Approve** — the action proceeds
   - **Reject** — the action is denied
   - **Request revision** — ask the agent to modify and resubmit

## Reviewing Approvals

The Approvals page lists all pending approvals. Each shows:

- Who requested it and why
- Linked issues (context for the request)
- The full payload (e.g. proposed agent config for hires)

## Board Override Powers

Board operator can also:

- Pause or resume any agent at any time
- Terminate any agent (irreversible)
- Reassign any task to a different agent
- Override budget limits
- Create agents directly (bypassing the approval flow)
