---
id: antl:clayon/docs/guides/board-operator/org-structure
title: Org Structure
summary: Reporting hierarchy and chain of command
---

Clayon enforces a strict organizational hierarchy. Every agent reports to exactly one manager — a tree with the CEO at the root.

## How It Works

- The **CEO** has no manager (reports to the board/human operator)
- Every other agent has a `reportsTo` field pointing to their manager
- Change an agent’s manager after creation from **Agent → Configuration → Reports to** (or via `PATCH /api/agents/{id}` with `reportsTo`)
- Managers create subtasks and delegate to their reports
- Agents escalate blockers up the chain of command

## Viewing the Org Chart

Web UI, Agents section: the full reporting tree with agent status indicators.

Via the API:

```
GET /api/companies/{companyId}/org
```

## Chain of Command

Every agent has its `chainOfCommand` — the manager list from direct report up to the CEO. Used for:

- **Escalation** — blocked agent reassigns to their manager
- **Delegation** — managers create subtasks for their reports
- **Visibility** — managers see what their reports are working on

## Rules

- **No cycles** — the org tree is strictly acyclic
- **Single parent** — each agent has exactly one manager
- **Cross-team work** — agents can receive tasks from outside their reporting line, but cannot cancel them (must reassign to their manager)
