---
id: antl:clayon/docs/start/quickstart
title: Quickstart
summary: Get Clayon running in minutes
---

Get Clayon running locally in under 5 minutes.

## Quick Start (Recommended)

```sh
npx clayon onboard --yes
```

This walks you through setup, configures your environment, and gets Clayon running.

If you already have a Clayon install, rerunning `onboard` keeps your current config and data paths intact. Use `clayon configure` if you want to edit settings.

To start Clayon again later:

```sh
npx clayon run
```

> **Note:** If you used `npx` for setup, always use `npx clayon` to run commands. The `bun run clayon` form only works inside a cloned copy of the Clayon repository (see Local Development below).

## Local Development

For contributors working on Clayon itself. Prerequisites: Node.js 24.11+ and Bun 1.4.3+.

Clone the repository, then:

```sh
bun install
bun run dev
```

This starts the API server and UI at [http://localhost:3100](http://localhost:3100).

No external database required — Clayon uses an embedded PostgreSQL instance by default.

When working from the cloned repo, you can also use:

```sh
bun run clayon run
```

This auto-onboards if config is missing, runs health checks with auto-repair, and starts the server.

## What's Next

Once Clayon is running:

1. Create your first company in the web UI
2. Define a company goal
3. Create a CEO agent and configure its adapter
4. Build out the org chart with more agents
5. Set budgets and assign initial tasks
6. Hit go — agents start their heartbeats and the company runs

<Card title="Core Concepts" href="/start/core-concepts">
  Learn the key concepts behind Clayon
</Card>
