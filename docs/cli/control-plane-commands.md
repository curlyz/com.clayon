---
id: antl:clayon/docs/cli/control-plane-commands
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
npx clayon issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
npx clayon issue get <issue-id-or-identifier>

# Create issue
npx clayon issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
npx clayon issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
npx clayon issue comment <issue-id> --body "..." [--reopen]

# Checkout task
npx clayon issue checkout <issue-id> --agent-id <agent-id>

# Release task
npx clayon issue release <issue-id>
```

## Company Commands

```sh
npx clayon company list
npx clayon company get <company-id>
npx clayon company current [--company-id <company-id>]

# Export to portable folder package (writes manifest + markdown files)
npx clayon company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
npx clayon company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
npx clayon company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

`company import` is unavailable against cloud-managed instances — the
server answers `403` with `code: "cloud_managed"`. Export remains available
there.

With agent authentication, use `company list` or `company current` to resolve
the scoped company. `company list` first tries the board-wide list; if that is
forbidden, it falls back to `--company-id`, `CLAYON_COMPANY_ID`, context, or
`/api/agents/me` and returns only that scoped company. `company create` requires
board/instance-admin authentication because it is an instance-wide setup
command.

## Agent Commands

```sh
npx clayon agent list
npx clayon agent get <agent-id>
```

## Skills Commands

```sh
# Browse app-shipped catalog skills without changing company state
npx clayon skills browse [--kind bundled|optional] [--category software-development] [--query github]
npx clayon skills search "pull request" [--json]

# Inspect catalog metadata and file inventory before install
npx clayon skills inspect github-pr-workflow

# Install a catalog skill into the company skill library
# This does not attach the skill to any agent.
npx clayon skills install github-pr-workflow --company-id <company-id>
npx clayon skills install github-pr-workflow --as pr-flow --force --company-id <company-id>

# External sources still use import instead of catalog install
npx clayon skills import ./skills/my-skill --company-id <company-id>
npx clayon skills import owner/repo/path/to/skill --company-id <company-id>

# Attach desired company skills to an agent after install/import
npx clayon skills agent sync <agent-id> --skill github-pr-workflow --mode add --company-id <company-id>
```

## Approval Commands

```sh
# List approvals
npx clayon approval list [--status pending]

# Get approval
npx clayon approval get <approval-id>

# Create approval
npx clayon approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
npx clayon approval approve <approval-id> [--decision-note "..."]

# Reject
npx clayon approval reject <approval-id> [--decision-note "..."]

# Request revision
npx clayon approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
npx clayon approval resubmit <approval-id> [--payload '{"..."}']

# Comment
npx clayon approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
npx clayon activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
npx clayon dashboard get
```

## Instance Settings

```sh
npx clayon instance settings:general
npx clayon instance settings:general:update --payload-json '{...}'
npx clayon instance settings:experimental
npx clayon instance settings:experimental:update --payload-json '{...}'
```

Experimental features are opt-in and are provided without compatibility guarantees. They may break, change, or be removed at any time. Use them at your own risk.

## Heartbeat

```sh
npx clayon heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
