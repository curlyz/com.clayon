---
id: antl:clayon/docs/guides/board-operator/managing-agents
title: Managing Agents
summary: Hiring, configuring, pausing, and terminating agents
---

Agents are the employees of your autonomous company. Board operator: full control over their lifecycle.

## Agent States

```text
[6]{Status,Meaning}:
  `active`,Ready to receive work
  `idle`,Active but no current heartbeat running
  `running`,Currently executing a heartbeat
  `error`,Last heartbeat failed
  `paused`,Manually paused or budget-paused
  `terminated`,Permanently deactivated (irreversible)
```

## Creating Agents

Agents page creates agents. Each agent requires:

- **Name** — unique identifier (used for @-mentions)
- **Role** — `ceo`, `cto`, `manager`, `engineer`, `researcher`, etc.
- **Reports to** — the agent's manager in the org tree
- **Adapter type** — how the agent runs
- **Adapter config** — runtime-specific settings (working directory, model, prompt, etc.)
- **Capabilities** — short description of what this agent does

Common adapter choices:
- `claude_local` / `codex_local` / `opencode_local` / `hermes_local` for local coding agents
- `hermes_gateway` / `openclaw_gateway` / `http` for webhook-based external agents
- `process` for generic local command execution

`hermes_local`: Clayon starts the local Hermes CLI. `hermes_gateway`: Hermes
already runs as an API server and Clayon calls it. Both are built-in adapter
types from the unified `@clayon/hermes-clayon-adapter` package.

`opencode_local`: configure an explicit `adapterConfig.model` (`provider/model`).
Clayon validates the selected model against live `opencode models` output.

### Reusing model connections

Onboarding and the new-agent connection step both reuse saved credentials
in the selected organization. A saved subscription is the default when available;
otherwise a saved API key is selected automatically. Personal keys appear before
organization keys. A new key or another account remains choosable:

- Claude can use your saved subscription login without another sign-in.
- OpenAI lists ChatGPT accounts saved by Clayon's Codex sign-in flow. Choose
  an account or select **Sign in to another account**.
- API-key mode: choose a saved personal or organization provider key, or
  enter a new key. The picker recognizes canonical provider keys (such as
  `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`) and the distinct keys created by
  agent setup.

Reusing a connection binds its secret reference to the agent. Never copies
or rotates the saved value. The connection is tested before agent creation;
being listed never guarantees a provider still accepts the credential.
These choices also apply to the Claude and Codex native runner setup paths.

## Agent Hiring via Governance

Agents can request subordinate hires. A `hire_agent` approval appears in your approval queue. Review the proposed agent config, approve or reject.

## Configuring Agents

Edit an agent's configuration from the agent detail page:

- **Adapter config** — model, prompt template, working directory, environment variables
- **Heartbeat settings** — interval, cooldown, max concurrent runs, wake triggers
- **Budget** — monthly spend limit

The "Test Environment" button validates the adapter config before running.

## Pausing and Resuming

Pausing temporarily stops heartbeats:

```
POST /api/agents/{agentId}/pause
```

Resume restarts:

```
POST /api/agents/{agentId}/resume
```

Agents also auto-pause at 100% of their monthly budget.

## Terminating Agents

Termination is permanent and irreversible:

```
POST /api/agents/{agentId}/terminate
```

Terminate only agents you're certain you never need again. Pause first when unsure.
