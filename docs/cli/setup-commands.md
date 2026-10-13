---
id: antl:clayon/docs/cli/setup-commands
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `clayon run`

One-command bootstrap and start:

```sh
pnpm clayon run
```

Does:

1. Auto-onboards if config is missing
2. Runs `clayon doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
npx clayon run --instance dev
```

## `clayon onboard`

Interactive first-time setup:

```sh
pnpm clayon onboard
```

If Clayon is already configured, rerunning `onboard` keeps the existing config in place. Use `clayon configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm clayon onboard --run
```

Quickstart defaults + immediate start:

```sh
pnpm clayon onboard --yes
```

When onboarding starts Clayon from an interactive terminal, it opens the
onboarding page in your browser once. Non-interactive terminals stay silent.
Suppress browser opening explicitly for headless or automated runs with either
environment variable:

```sh
CLAYON_NO_BROWSER=1 pnpm clayon onboard --yes
CLAYON_OPEN_ON_LISTEN=false pnpm clayon onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts Clayon with that setup.

## `clayon doctor`

Health checks with optional auto-repair:

```sh
pnpm clayon doctor
pnpm clayon doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration, including AWS Secrets Manager non-secret env
  config when selected
- Storage configuration
- Missing key files

## `clayon configure`

Update configuration sections:

```sh
pnpm clayon configure --section server
pnpm clayon configure --section secrets
pnpm clayon configure --section storage
```

`--section secrets` updates the deployment-level provider used as the fallback
for secrets that do not target a specific company vault. Per-company provider
vaults (named instances, default vault selection, multiple vaults per provider,
coming-soon GCP/Vault) live in the board UI under
`Company Settings → Secrets → Provider vaults` and the
`/api/companies/{companyId}/secret-provider-configs` API.

## `clayon env`

Show resolved environment configuration:

```sh
pnpm clayon env
```

This now includes bind-oriented deployment settings such as `CLAYON_BIND` and `CLAYON_BIND_HOST` when configured.

## `clayon allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
npx clayon allowed-hostname my-tailscale-host
```

## Local Storage Paths

```text
[5]{Data,Default Path}:
  Config,`~/.clayon/instances/default/config.json`
  Database,`~/.clayon/instances/default/db`
  Logs,`~/.clayon/instances/default/logs`
  Storage,`~/.clayon/instances/default/data/storage`
  Secrets key,`~/.clayon/instances/default/secrets/master.key`
```

Override with:

```sh
CLAYON_HOME=/custom/home CLAYON_INSTANCE_ID=dev pnpm clayon run
```

Or pass `--data-dir` directly on any command:

```sh
npx clayon run --data-dir ./tmp/clayon-dev
npx clayon doctor --data-dir ./tmp/clayon-dev
```
