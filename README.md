# Clayon

Clayon is a control plane for AI-agent companies: a Node.js server and
React UI that orchestrates a team of AI agents. Bring your own agents,
assign goals, and track work and costs from one dashboard.

This is the anatalab takeover of the upstream project (2026-10-11). The
upstream clayon/clayon repo, its docs site, and its community
channels are no longer referenced or followed.

- Product docs: [doc/](doc/) — start with [doc/GOAL.md](doc/GOAL.md),
  [doc/PRODUCT.md](doc/PRODUCT.md) and [doc/SPEC-implementation.md](doc/SPEC-implementation.md)
- Development guide: [doc/DEVELOPING.md](doc/DEVELOPING.md)
- Repo law: [AGENTS.md](AGENTS.md)
- Production: the Dokploy stack `clayon` on the antl VPS, live at
  <https://clayon.app> (runbook in `../servers/contabo-eu-vps6/README.md`)

## What it does

|        | Step            | Example                                                            |
| ------ | --------------- | ------------------------------------------------------------------ |
| **01** | Define the goal | _"Build the #1 AI note-taking app to $1M MRR."_                    |
| **02** | Hire the team   | CEO, CTO, engineers, designers, marketers — any bot, any provider. |
| **03** | Approve and run | Review strategy. Set budgets. Hit go. Monitor from the dashboard.  |

Any agent that can receive a heartbeat joins the org chart: Claude Code,
Codex, OpenClaw, Cursor, Gemini CLI, OpenCode, Pi, Hermes, Grok, Kimi, plus
custom processes, HTTP endpoints, and external adapter packages.

Four pillars: agentic task manager, org chart for agents, agent employee
training, and the agentic OS (sandboxing, integrations, MCP servers, SSO,
RBAC, cost controls). Full inventory: [ROADMAP.md](ROADMAP.md).

## Quickstart

With **Node.js 24.11+** and **Bun 1.4.3+**:

```bash
git clone git@github.com:anatalab/antl.git && cd antl
cd com.paperclip        # Clayon lives inside the antl workspace
bun install
bun run dev
```

This starts the UI and API at `http://localhost:3100` with an embedded
PostgreSQL database created automatically.

Dev UI against the production backend (writes hit production data):

```bash
bun run --cwd ui dev:remote   # http://localhost:2009, /api proxied to clayon.curly.ng (designated origin, not currently deployed — no DNS record yet)
```

For an isolated test instance with a CEO agent already initialized:

```bash
ANTHROPIC_API_KEY=... npx clayon test-drive
```

Source development also builds the native Clayon Runner when enabled (the
self-hosted default). Install a Rust toolchain, or set `CLAYON_RUNNER_BINARY`
to a compatible prebuilt runner.

## Development

```bash
bun run dev              # Full dev (API + UI, watch mode)
bun run dev:once         # Full dev without file watching
bun run dev:server       # Server only
bun run dev:mobile       # Serve prebuilt UI on :3101 for phones/tablets (proxies /api → :3100)
bun run dev:both         # Run `bun run dev` and `bun run dev:mobile` together
bun run build            # Build all
bun run typecheck        # Type checking
bun run test             # Cheap default test run (Vitest only)
bun run test:watch       # Vitest watch mode
bun run test:e2e         # Playwright browser suite
bun run db:generate      # Generate DB migration
bun run db:migrate       # Apply migrations
```

`bun run test` does not run Playwright. Browser suites stay separate and are
typically run only when working on those flows or in CI. See
[doc/DEVELOPING.md](doc/DEVELOPING.md) for the full guide.

## Observability

Opt-in OpenTelemetry tracing (server) activates when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set. Opt-in Sentry error monitoring
activates with `SENTRY_DSN_FRONTEND` / `SENTRY_DSN_BACKEND`. Details:
[doc/observability.md](doc/observability.md).

## Telemetry

Telemetry is enabled by default and can be disabled with
`CLAYON_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1`, CI detection, or
`telemetry.enabled: false` in the config file. Contract:
[packages/shared/src/telemetry/README.md](packages/shared/src/telemetry/README.md).

## License

MIT.
