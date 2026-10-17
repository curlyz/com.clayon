---
id: antl:clayon/docs/start/architecture
title: Architecture
summary: Stack overview, request flow, and adapter model
---

Clayon is a monorepo with four main layers.

## Stack Overview

```
┌─────────────────────────────────────┐
│  React UI (Vite)                    │
│  Dashboard, org management, tasks   │
├─────────────────────────────────────┤
│  Express.js REST API (Node.js)      │
│  Routes, services, auth, adapters   │
├─────────────────────────────────────┤
│  PostgreSQL (Drizzle ORM)           │
│  Schema, migrations, embedded mode  │
├─────────────────────────────────────┤
│  Adapters                           │
│  Claude Code, Codex,                │
│  Process, HTTP                      │
└─────────────────────────────────────┘
```

## Technology Stack

```text
[6]{Layer,Technology}:
  Frontend,"React 19, Vite 8, React Router 7, Radix UI, Tailwind CSS 4, TanStack Query"
  Backend,"Node.js 24.11+, Express.js 5, TypeScript"
  Database,"Embedded PostgreSQL (pglite aliases are legacy config), Drizzle ORM"
  Auth,"Better Auth (sessions + API keys)"
  Adapters,"Claude Code CLI, Codex CLI, shell process, HTTP webhook"
  Package manager,Bun with workspaces
```

## Repository Structure

```
clayon/
├── ui/                          # React frontend
│   ├── src/pages/              # Route pages
│   ├── src/components/         # React components
│   ├── src/api/                # API client
│   └── src/context/            # React context providers
│
├── server/                      # Express.js API
│   ├── src/routes/             # REST endpoints
│   ├── src/services/           # Business logic
│   ├── src/adapters/           # Agent execution adapters
│   └── src/middleware/         # Auth, logging
│
├── packages/
│   ├── db/                      # Drizzle schema + migrations
│   ├── shared/                  # API types, constants, validators
│   ├── adapter-utils/           # Adapter interfaces and helpers
│   └── adapters/
│       ├── claude-local/        # Claude Code adapter
│       └── codex-local/         # OpenAI Codex adapter
│
├── skills/                      # Agent skills
│   └── clayon/               # Core Clayon skill (heartbeat protocol)
│
├── cli/                         # CLI client
│   └── src/                     # Setup and control-plane commands
│
└── doc/                         # Internal documentation
```

## Request Flow

When a heartbeat fires:

1. **Trigger** — Scheduler, manual invoke, or event (assignment, assignee feedback) triggers a heartbeat
2. **Adapter invocation** — Server calls the configured adapter's `execute()` function
3. **Agent process** — Adapter spawns the agent (e.g. Claude Code CLI) with Clayon env vars and a prompt
4. **Agent work** — The agent calls Clayon's REST API to check assignments, checkout tasks, do work, and update status
5. **Result capture** — Adapter captures stdout, parses usage/cost data, extracts session state
6. **Run record** — Server records the run result, costs, and any session state for next heartbeat

## Adapter Model

Adapters are the bridge between Clayon and agent runtimes. Each adapter is a package with three modules:

- **Server module** — `execute()` function that spawns/calls the agent, plus environment diagnostics
- **UI module** — stdout parser for the run viewer, config form fields for agent creation
- **CLI module** — terminal formatter for `clayon run --watch`

Built-in adapter type keys (corrected 2026-10-17 to match `docs/adapters/overview.md` and the 12 live packages under `packages/adapters/`): `claude_local`, `codex_local`, `cursor_local`, `cursor_cloud`, `grok_local`, `opencode_local`, `pi_local`, `process`, `http`, and the gateway adapters (hermes, hermes-gateway, openclaw-gateway). You can create custom adapters for any runtime.

## Key Design Decisions

- **Control plane, not execution plane** — Clayon orchestrates agents; it doesn't run them
- **Company-scoped** — all entities belong to exactly one company; strict data boundaries
- **Single-assignee tasks** — atomic checkout prevents concurrent work on the same task
- **Adapter-agnostic** — any runtime that can call an HTTP API works as an agent
- **Embedded by default** — zero-config local mode with embedded PostgreSQL
