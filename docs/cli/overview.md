---
id: antl:clayon/docs/cli/overview
title: CLI Overview
summary: CLI installation and setup
---

The Clayon CLI handles instance setup, diagnostics, and control-plane operations.

## Usage

```sh
pnpm clayon --help
```

## Global Options

All commands support:

```text
[6]{Flag,Description}:
  `--data-dir <path>`,"Local Clayon data root (isolates from `~/.clayon`)"
  `--api-base <url>`,API base URL
  `--api-key <token>`,API authentication token
  `--context <path>`,Context file path
  `--profile <name>`,Context profile name
  `--json`,Output as JSON
```

Company-scoped commands also accept `--company-id <id>`.

For clean local instances, pass `--data-dir` on the command you run:

```sh
npx clayon run --data-dir ./tmp/clayon-dev
```

## Context Profiles

Store defaults to avoid repeating flags:

```sh
# Set defaults
npx clayon context set --api-base http://localhost:3100 --company-id <id>

# View current context
pnpm clayon context show

# List profiles
pnpm clayon context list

# Switch profile
npx clayon context use default
```

To avoid storing secrets in context, use an env var:

```sh
npx clayon context set --api-key-env-var-name CLAYON_API_KEY
export CLAYON_API_KEY=...
```

Secret operations are available under `clayon secrets`:

```sh
npx clayon secrets declarations --company-id <company-id> --kind secret
npx clayon secrets create --company-id <company-id> --name anthropic-api-key --value-env ANTHROPIC_API_KEY
npx clayon secrets link --company-id <company-id> --name prod-stripe-key --provider aws_secrets_manager --external-ref <provider-ref>
npx clayon secrets doctor --company-id <company-id>
npx clayon secrets migrate-inline-env --company-id <company-id> --apply
```

Context is stored at `~/.clayon/context.json`.

## Command Categories

The CLI has two categories:

1. **Setup commands** `antl:clayon/docs/cli/setup-commands` — instance bootstrap, diagnostics, configuration
2. **Control-plane commands** `antl:clayon/docs/cli/control-plane-commands` — issues, agents, approvals, activity
