---
id: antl:clayon/docs/deploy/local-development
title: Local Development
summary: Set up Clayon for local development
---

Run Clayon locally with zero external dependencies.

## Prerequisites

- Node.js 24.11+
- pnpm 9+

## Start Dev Server

```sh
pnpm install
pnpm dev
```

This starts:

- **API server** at `http://localhost:3100`
- **UI** served by the API server in dev middleware mode (same origin)

No Docker or external database required. Clayon uses embedded PostgreSQL automatically.

## One-Command Bootstrap

First-time install:

```sh
pnpm clayon run
```

This does:

1. Auto-onboards if config is missing
2. Runs `clayon doctor` with repair enabled
3. Starts the server when checks pass

## Bind Presets In Dev

Default `pnpm dev` stays in `local_trusted` with loopback-only binding.

To open Clayon to a private network with login enabled:

```sh
pnpm dev --bind lan
```

For Tailscale-only binding on a detected tailnet address:

```sh
pnpm dev --bind tailnet
```

Legacy aliases still work and map to the older broad private-network behavior:

```sh
pnpm dev --tailscale-auth
pnpm dev --authenticated-private
```

Allow additional private hostnames:

```sh
npx clayon allowed-hostname dotta-macbook-pro
```

For full setup and troubleshooting, see Tailscale Private Access `antl:clayon/docs/deploy/tailscale-private-access`.

## Health Checks

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## Safe Worktree Bootstrap for Local Agent Runs

For safer parallel local experiments, initialize a dedicated worktree instance instead of reusing the main checkout:

```sh
npx clayon worktree:make local-lab --seed-mode minimal
cd ~/clayon-local-lab
pnpm clayon worktree env                       # inspect generated env exports
eval "$(npx clayon worktree env)"             # bash/zsh
pnpm clayon run
pnpm clayon doctor
```

If the experiment gets noisy, repair or reseed the worktree without touching the main branch:

```sh
# worktree repair rebuilds the local checkout metadata, so run the checked-out CLI through the direct-exec form.
node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts worktree repair --branch clayon-local-lab
npx clayon worktree reseed --from . --to clayon-local-lab
```

When done, shut it down and remove the isolated state explicitly:

```sh
npx clayon worktree:cleanup local-lab --force
```

## Reset Dev Data

To wipe local data and start fresh:

```sh
rm -rf ~/.clayon/instances/default/db
pnpm dev
```

## Data Locations

```text
[5]{Data,Path}:
  Config,`~/.clayon/instances/default/config.json`
  Database,`~/.clayon/instances/default/db`
  Storage,`~/.clayon/instances/default/data/storage`
  Secrets key,`~/.clayon/instances/default/secrets/master.key`
  Logs,`~/.clayon/instances/default/logs`
```

Override with environment variables:

```sh
CLAYON_HOME=/custom/path CLAYON_INSTANCE_ID=dev pnpm clayon run
```
