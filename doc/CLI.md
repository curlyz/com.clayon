# CLI Reference

Clayon CLI now supports both:

- installation and lifecycle management (`install`, `uninstall`, `update`, `upgrade`, `service`)
- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`, `env-lab`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Security: safe invocation for content-bearing arguments

Use `npx clayon` for any command whose argument can hold untrusted or
semi-trusted content. Untrusted content includes issue text, comment bodies,
Markdown, pasted snippets, and model output. `npx` runs the CLI binary directly.
It passes the argument as an inert `argv` value. It does not run a shell over the
value. `npx clayon` works on any machine with Node: it runs a local install
of the `clayon` package, and it fetches the published package when no local
install is present.

Do not use `pnpm clayon` for a content-bearing argument. `pnpm clayon`
is a `package.json` script. `pnpm` builds a `/bin/sh` command string and appends
the argument to it, so the shell reads the argument first. The shell interprets
these spans before the CLI starts:

- command substitution: a backtick pair or `$( )`
- variable expansion: `$NAME` or `${NAME}` (this can leak a secret value into the persisted argument)

A crafted value can run an arbitrary command as the invoking user. A crafted
value can also expand an environment variable into the stored argument. No
CLI-side check stops this, because the shell runs before `cli/src` starts. This
is true even when the argument comes from a quoted shell variable, because `pnpm`
re-evaluates the value in its own shell.

Safe forms:

- `npx clayon <command> <args>` — the documented default. It passes an inert
  `argv` value and runs on any machine.
- `node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts <command> <args>` —
  the safe form to run the local source from a monorepo checkout. It is the exact
  command that the `pnpm clayon` script wraps, but it runs directly, so no
  shell reads the argument. Use it when you must test your local `cli/src`
  changes with a content-bearing argument.

Unsafe or broken forms:

- `pnpm clayon <command> <args>` — unsafe. `pnpm` runs the argument through a
  shell first.
- `pnpm run <script> -- <args>`, or any `package.json` script that wraps the CLI —
  unsafe for the same reason.
- `pnpm exec clayon <command> <args>` — broken. The root workspace does not
  depend on the `clayon` package, so `pnpm` does not link its binary into
  `node_modules/.bin`. The command fails with `Command "clayon" not found`,
  even after a build. Do not use it.

Static placeholders only: a document must show a static placeholder such as
`<host>` in a command example, never a live `$( )` or `$NAME` span. The reader's
own shell expands such a span on paste, before any CLI or `npx` receives argv, so
a direct-exec form does not stop it.

`pnpm clayon` stays acceptable only for a fully literal local lifecycle or
setup command. A fully literal command carries no substitutable value. It has no
placeholder, no example value the reader replaces, no interpolation, no path, no
ref, no id, and no name. It holds the subcommand and, at most, flags that take no
value.

The allowlist of literal commands lives in one place:
`server/src/__tests__/cli-invocation-safety.test.ts`. A guard test enforces it
fail-closed. Any `pnpm clayon` line whose command string is not an exact
allowlist entry is an offender. The allowlist holds commands such as `run`,
`onboard`, `onboard --yes`, `doctor`, `configure --section <name>`, `connect`,
`env-lab up`, `env-lab down`, `context show`, `context list`,
`worktree ensure-seeded`, and `worktree env`.

Every invocation that carries a positional value or an option value uses
`npx clayon` instead. This covers a hostname (`allowed-hostname`), an import
URL or folder (`company import`), an identifier or secret (`--company-id`,
`--agent-id`, `--claim-secret`), a payload (`--payload-json`), free text
(`--body`, `--title`, `--comment`), a data directory (`--data-dir`), an instance
(`--instance`), a bind preset (`--bind`), a context-profile name, and every
worktree path, ref, id, or name option. A runtime value counts as non-fixed even
when it looks safe. The private-hostname guard builds `allowed-hostname <value>`
from the request Host header, so it uses `npx clayon`.

For a command that must run the local checked-out source with a value, use the
direct-exec form: `node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts
<command> <args>`.

The `pnpm --filter @clayon/*` build and test commands are not CLI
invocation. They do not change.

### Offline and air-gapped use

`npx clayon` runs offline when the `clayon` package is already in a
local install or in the npm cache. It reaches the network only when the package
is in neither place.

To force cache-only resolution and block any network attempt, run
`npx --offline clayon <command> <args>`. Use `npx --prefer-offline
clayon` when you accept a fetch only for a missing package.

To prepare an air-gapped host, install the package one time while the host is
online. Run `npm install -g clayon`, or run the documented `install.sh`
path. After that step, both `npx clayon` and the installed `clayon`
binary run offline. Both pass an inert `argv` value.

To move the package without a registry, run `npm pack clayon` on an online
host. Copy the tarball to the air-gapped host. Run `npm install -g
./clayon-<version>.tgz`.

Do not use `pnpm clayon` as an offline fallback for a content-bearing
argument. It runs the argument through a shell first, offline or online. It also
resolves only inside a monorepo checkout.

A monorepo contributor who works offline uses the direct-exec form that this
section documents above: `node cli/node_modules/tsx/dist/cli.mjs
cli/src/index.ts <command> <args>`. It passes an inert `argv` value and runs the
local source.

## Base Usage

Use repo script in development:

```sh
pnpm clayon --help
```

Recommended installation and interactive onboarding:

```sh
curl -fsSLO https://clayon.ing/install.sh
curl -fsSLO https://clayon.ing/install.sh.sha256
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c install.sh.sha256
else
  shasum -a 256 -c install.sh.sha256
fi
bash install.sh
```

The checksum detects transfer or publishing mistakes but is served from the
same origin as the installer. Use a release-tag or commit-pinned GitHub copy
when you need an independently hosted source. Piped installs require supported
Node.js, npm, and npx to already be installed; download the script first before
allowing it to bootstrap Node.js with privileged package-manager commands.

First-time local bootstrap from a source checkout:

```sh
pnpm clayon run
```

Choose local instance:

```sh
npx clayon run --instance dev
```

## Isolated Manual Test Drives

`clayon test-drive` creates or reuses an isolated local data directory,
ensures one usable CEO agent exists in a fresh database, starts Clayon in the
foreground, and opens the browser after initialization succeeds. It never
installs a background service and never creates a goal, project, issue, task,
or heartbeat.

```sh
npx clayon test-drive \
  [-d, --data-dir <path>] \
  [--company-name <name>] \
  [--agent-name <name>] \
  [--harness <claude|codex|opencode>] \
  [--model <model-id>] \
  [--api-key-env <variable> | --api-key <value>] \
  [--no-browser]
```

Defaults are `Test Company`, a `CEO` agent with the `ceo` role, and the Claude
harness. Without `--data-dir`, every invocation creates a unique OS temporary
directory and prints its absolute path. The directory is retained after exit
for inspection. An explicit data directory is reused and is never reset. The
reused directory must use Clayon's embedded database; `DATABASE_URL`,
`DATABASE_MIGRATION_URL`, and configs with `database.mode: postgres` are
rejected so test-drive cannot mutate an external database. The server also
ignores the invocation directory's `.env` for test-drive launches, while still
loading the selected instance's own environment file. Reused directories also
retain the normal guard against colliding with a managed Clayon service. The
server uses the first available loopback port at or above `3100`, so an
unrelated local Clayon process can remain running.

Harness configuration:

| Harness | Agent adapter | Agent credential variable | Model |
| --- | --- | --- | --- |
| `claude` | `claude_local` | `ANTHROPIC_API_KEY` | Optional; omitted uses the adapter default |
| `codex` | `codex_local` | `OPENAI_API_KEY` | Optional; omitted uses the adapter default |
| `opencode` | `opencode_local` | `OPENROUTER_API_KEY` | Required and must begin with `openrouter/` |

OpenCode model references retain their complete path, including additional
slashes:

```sh
OPENROUTER_API_KEY=... npx clayon test-drive \
  --harness opencode \
  --model openrouter/anthropic/claude-sonnet-4.5
```

Credentials come from `--api-key`, the variable named by `--api-key-env`, or
the harness's canonical environment variable shown in the table. `--api-key`
and `--api-key-env` are mutually exclusive. A custom source variable is still
stored and projected under the canonical target variable:

```sh
MY_ROUTER_KEY=... npx clayon test-drive \
  --harness opencode \
  --model openrouter/openai/gpt-5.4 \
  --api-key-env MY_ROUTER_KEY
```

Credentials are stored through Clayon's user-secret reference path and are
redacted from Clayon command output. Clayon does not print `--api-key`,
and it removes the value from its JavaScript argument view immediately after
Commander parses it. Clayon does not put the raw argument list in telemetry,
API metadata, or diagnostics. Command wrappers, operating-system process
listings, and shell history can still expose values passed in arguments. This
is an explicit tradeoff for the local test-drive workflow. Prefer an exported
canonical variable or `--api-key-env` when that matters. Provider connectivity,
local harness installation, credential validity, and model availability are
intentionally checked only when the agent first runs.

When invoked inside a linked Git worktree, the command ignores inherited
`CLAYON_IN_WORKTREE` state, launches in worktree mode, and verifies **Run
tasks in this worktree** is armed for the current instance before opening the
browser. In a primary checkout or non-Git directory it launches without
worktree mode and does not alter the setting. On reuse, if any company already
exists, all bootstrap flags are ignored and companies, agents, and secrets are
left untouched; worktree-setting reconciliation is the only permitted
mutation.

Use `--no-browser` for a foreground instance that prints its ready URL without
opening it.

## Install, Update, And Uninstall

Managed installs keep CLI payloads under `~/.clayon/cli`, expose a stable
`~/.local/bin/clayon` shim, switch versions atomically, and retain two
previous payloads for rollback.

```sh
clayon install
clayon install --canary
clayon install --version <version>
clayon install --ref <branch|tag|sha> [--repo owner/repo]
clayon update
clayon update --latest|--canary|--version <version>
clayon update --rollback
clayon upgrade
clayon uninstall
```

`upgrade` aliases `update`. `uninstall` removes managed code and the shim but
preserves instance data under `~/.clayon/instances/`. See
`doc/INSTALLING.md` for installation methods, security notes, PATH setup, and
the complete update and rollback behavior.

## Onboarding And Service Management

Interactive onboarding offers to install a background service on supported
platforms. `--yes` never installs it implicitly; automation must opt in.

```sh
clayon onboard
clayon onboard --yes
clayon onboard --yes --install-service
clayon onboard --yes --no-install-service
```

Service lifecycle commands remain under the `service` namespace:

```sh
clayon service install [--no-start-now] [--no-start-on-login]
clayon service uninstall
clayon service start
clayon service stop
clayon service restart [--wait]
clayon service status [--json]
clayon service logs [-f]
```

Every service verb supports `--instance <id>` and `--json`. Linux and WSL2 use
a systemd user unit when available; macOS uses a LaunchAgent. Unsupported
environments receive foreground `clayon run` guidance.

`clayon doctor` includes managed-install and service-health diagnostics in
addition to configuration, storage, database, logging, and port checks.

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `clayon onboard` and `clayon configure --section server` set deployment mode in config
- server onboarding/configure ask for reachability intent and write `server.bind`
- `clayon run --bind <loopback|lan|tailnet>` passes a quickstart bind preset into first-run onboarding when config is missing
- runtime can override mode with `CLAYON_DEPLOYMENT_MODE`
- `clayon run` and `clayon doctor` still do not expose a direct low-level `--mode` flag

Canonical behavior is documented in `doc/DEPLOYMENT-MODES.md`.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
npx clayon allowed-hostname dotta-macbook-pro
```

Bring up the default local SSH fixture for environment testing:

```sh
pnpm clayon env-lab up
pnpm clayon env-lab doctor
pnpm clayon env-lab status --json
pnpm clayon env-lab down
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

API base resolution order:

1. `--api-base <url>`
2. `CLAYON_API_URL`
3. selected context profile `apiBase`
4. local Clayon config server port
5. `http://localhost:3100`

Connection failures include the attempted URL and a `GET /api/health` check hint.

## Connect Wizard

```sh
pnpm clayon connect
```

`connect` confirms the resolved API base, verifies `GET /api/health`, authenticates board access when needed, and saves a persona-aware profile:

- `persona=board` for board operator profiles
- `persona=agent` with `agentId` and `agentName` for agent profiles

Profiles store token env-var names, not plaintext tokens. The wizard prints shell exports for the newly created token.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.clayon`:

```sh
npx clayon run --data-dir ./tmp/clayon-dev
npx clayon issue list --data-dir ./tmp/clayon-dev
```

## Context Profiles

Store local defaults in `~/.clayon/context.json`:

```sh
npx clayon context set --api-base http://localhost:3100 --company-id <company-id>
npx clayon context set --persona agent --agent-id <agent-id> --api-key-env-var-name CLAYON_API_KEY
pnpm clayon context show
pnpm clayon context list
npx clayon context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
npx clayon context set --api-key-env-var-name CLAYON_API_KEY
export CLAYON_API_KEY=...
```

## Organization Commands

```sh
npx clayon company list
npx clayon company get <company-id>
npx clayon company current [--company-id <company-id>]
npx clayon company stats
npx clayon company create --payload-json '{...}'
npx clayon company update <company-id> --payload-json '{...}'
npx clayon company branding:update <company-id> --payload-json '{...}'
npx clayon company archive <company-id>
npx clayon company export <company-id> --out ./company --include company,agents,projects,issues,skills
npx clayon company export:preview <company-id> --payload-json '{...}'
npx clayon company export:api <company-id> --payload-json '{...}'
npx clayon company import ./company --target new --new-company-name "Imported Company"
npx clayon company import:preview <company-id> --payload-json '{...}'
npx clayon company import:apply <company-id> --payload-json '{...}'
npx clayon company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
npx clayon company delete PAP --yes --confirm PAP
npx clayon company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- With agent authentication, `company list` and `company current` are
  agent-safe company selectors. `company list` first tries the board-wide list;
  if that is forbidden, it uses `--company-id`, `CLAYON_COMPANY_ID`, context,
  or `/api/agents/me` and then reads only that scoped company.
- `company create` requires board/instance-admin authentication because it is
  an instance-wide setup command.
- Deletion is server-gated by `CLAYON_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `CLAYON_COMPANY_ID`), not another company.

## Issue Commands

```sh
npx clayon issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
npx clayon issue get <issue-id-or-identifier>
npx clayon issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high] [--parent-id <issue-id> | --standalone]
npx clayon issue update <issue-id> [--status in_progress] [--comment "..."]
npx clayon issue delete <issue-id> --yes
npx clayon issue comment <issue-id> --body "..." [--attachment-id <id...>] [--reopen]
npx clayon issue comments <issue-id> [--limit 50]
npx clayon issue comment:get <issue-id> <comment-id>
npx clayon issue comment:delete <issue-id> <comment-id>
npx clayon issue runs <issue-id-or-identifier>
npx clayon issue live-runs <issue-id-or-identifier>
npx clayon issue active-run <issue-id-or-identifier>
npx clayon issue heartbeat-context <issue-id>
npx clayon issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
npx clayon issue release <issue-id>
npx clayon issue force-release <issue-id>
```

`issue create` sent from an agent run bound to an ordinary execution task is parented under that task when `--parent-id` is omitted; pass `--standalone` to create intentionally top-level work (`parentId: null`). The two flags are mutually exclusive.

Issue subresources are exposed as Clayon API wrappers. Commands that map to broad server schemas accept JSON payloads and validate them with shared schemas before sending.

```sh
npx clayon issue child:create <issue-id> --payload-json '{"title":"Child task"}'
npx clayon issue approvals <issue-id>
npx clayon issue approval:link <issue-id> <approval-id>
npx clayon issue approval:unlink <issue-id> <approval-id>
npx clayon issue read <issue-id>
npx clayon issue unread <issue-id>
npx clayon issue archive <issue-id>
npx clayon issue unarchive <issue-id>
npx clayon issue recovery-actions <issue-id>
npx clayon issue recovery:resolve <issue-id> --outcome restored --source-issue-status todo
```

```sh
npx clayon issue documents <issue-id> [--include-system]
npx clayon issue document:get <issue-id> <key>
npx clayon issue document:put <issue-id> <key> --body-file ./plan.md [--title Plan]
npx clayon issue document:lock <issue-id> <key>
npx clayon issue document:unlock <issue-id> <key>
npx clayon issue document:revisions <issue-id> <key>
npx clayon issue document:restore <issue-id> <key> <revision-id>
npx clayon issue document:delete <issue-id> <key>
```

```sh
npx clayon issue work-products <issue-id>
npx clayon issue work-product:create <issue-id> --payload-json '{"type":"pull_request","provider":"github","title":"PR"}'
npx clayon issue work-product:update <work-product-id> --payload-json '{"status":"archived"}'
npx clayon issue work-product:delete <work-product-id>
npx clayon issue interactions <issue-id>
npx clayon issue interaction:create <issue-id> --payload-json '{"kind":"request_confirmation","payload":{"version":1,"prompt":"Continue?"}}'
npx clayon issue interaction:accept <issue-id> <interaction-id> [--selected-client-keys key1,key2]
npx clayon issue interaction:reject <issue-id> <interaction-id> [--reason "..."]
npx clayon issue interaction:respond <issue-id> <interaction-id> --answers-json '[{"questionId":"q1","optionIds":["yes"]}]'
npx clayon issue interaction:cancel <issue-id> <interaction-id> [--reason "..."]
```

```sh
npx clayon issue tree-state <issue-id>
npx clayon issue tree-preview <issue-id> --payload-json '{"mode":"pause"}'
npx clayon issue tree-holds <issue-id> [--status active] [--include-members]
npx clayon issue tree-hold:create <issue-id> --payload-json '{"mode":"pause","reason":"review"}'
npx clayon issue tree-hold:get <issue-id> <hold-id>
npx clayon issue tree-hold:release <issue-id> <hold-id> [--payload-json '{"reason":"done"}']
npx clayon issue attachments <issue-id>
npx clayon issue attachment:upload <issue-id> --company-id <company-id> --file ./artifact.txt
npx clayon issue attachment:download <attachment-id> [--out ./artifact.txt]
npx clayon issue attachment:delete <attachment-id>
npx clayon issue label:list --company-id <company-id>
npx clayon issue label:create --company-id <company-id> --name bug --color '#ff0000'
npx clayon issue label:delete <label-id>
npx clayon issue feedback:votes <issue-id>
npx clayon issue feedback:vote <issue-id> --payload-json '{"targetType":"issue_comment","targetId":"...","vote":"up"}'
```

## Project Commands

```sh
npx clayon project list --company-id <company-id>
npx clayon project get <project-id-or-shortname> [--company-id <company-id>]
npx clayon project create --company-id <company-id> --name "Launch Site" [--goal-ids <id1,id2>] [--lead-agent-id <id>]
npx clayon project update <project-id-or-shortname> [--status in_progress] [--company-id <company-id>]
npx clayon project delete <project-id-or-shortname> --yes [--company-id <company-id>]
```

Advanced project fields accept JSON:

```sh
npx clayon project create --company-id <company-id> --name "Ops" --env-json '{"OPENAI_API_KEY":{"kind":"secret","secretName":"openai-api-key"}}'
npx clayon project update <project-id> --execution-workspace-policy-json '{"enabled":true,"defaultMode":"shared_workspace"}'
```

## Goal Commands

```sh
npx clayon goal list --company-id <company-id>
npx clayon goal get <goal-id>
npx clayon goal create --company-id <company-id> --title "Grow revenue" [--level company] [--status active]
npx clayon goal update <goal-id> [--title "..."] [--status achieved]
npx clayon goal delete <goal-id> --yes
```

## Agent Commands

```sh
npx clayon agent list --company-id <company-id>
npx clayon agent get <agent-id>
npx clayon agent create --company-id <company-id> --payload-json '{"name":"Builder","adapterType":"codex_local"}'
npx clayon agent hire --company-id <company-id> --payload-json '{...}'
npx clayon agent update <agent-id> --payload-json '{"title":"Senior Builder"}'
npx clayon agent delete <agent-id> --yes
npx clayon agent me
npx clayon agent inbox
npx clayon agent inbox-mine --user-id <board-user-id>
npx clayon agent wake <agent-id-or-shortname> [--company-id <company-id>] [--reason "..."] [--payload '{"issueId":"..."}']
npx clayon agent pause <agent-id>
npx clayon agent resume <agent-id>
npx clayon agent approve <agent-id>
npx clayon agent terminate <agent-id>
npx clayon agent heartbeat:invoke <agent-id>
npx clayon agent claude-login <agent-id>
npx clayon agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

Agent configuration and runtime endpoints:

```sh
npx clayon agent permissions:update <agent-id> --payload-json '{"canCreateAgents":true,"canCreateSkills":true,"canAssignTasks":true}'
npx clayon agent configuration <agent-id>
npx clayon agent config-revisions <agent-id>
npx clayon agent config-revision:get <agent-id> <revision-id>
npx clayon agent config-revision:rollback <agent-id> <revision-id>
npx clayon agent runtime-state <agent-id>
npx clayon agent runtime-state:reset-session <agent-id> [--task-key <key>]
npx clayon agent task-sessions <agent-id>
npx clayon agent skills <agent-id>
npx clayon agent skills:sync <agent-id> --desired-skills clayon,github --mode add
npx clayon agent instructions-path:update <agent-id> --payload-json '{"path":"/path/to/AGENTS.md"}'
npx clayon agent instructions-bundle <agent-id>
npx clayon agent instructions-bundle:update <agent-id> --payload-json '{"mode":"managed"}'
npx clayon agent instructions-file:get <agent-id> --path AGENTS.md
npx clayon agent instructions-file:put <agent-id> --path AGENTS.md --content-file ./AGENTS.md
npx clayon agent instructions-file:delete <agent-id> --path AGENTS.md
```

Agent config, instructions, skills, project env, environment, secret, and workspace edits affect the next run. Active runs finish with the config they started with. When a saved session, reused workspace, or sandbox lease no longer matches the effective next-run config, Clayon may start fresh execution and records non-sensitive freshness categories in run result JSON and workspace operation logs.

`agent local-cli` is the quickest way to run local Claude/Codex manually as a Clayon agent:

- creates a new long-lived agent API key
- installs missing Clayon skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `CLAYON_API_URL`, `CLAYON_COMPANY_ID`, `CLAYON_AGENT_ID`, and `CLAYON_API_KEY`

Example for shortname-based local setup:

```sh
npx clayon agent local-cli codexcoder --company-id <company-id>
npx clayon agent local-cli claudecoder --company-id <company-id>
```

## Token Commands

Agent API keys are scoped to one company and one agent. Plaintext tokens are printed once at creation.

```sh
npx clayon token agent create --company-id <company-id> --agent <agent-id-or-name> --name external-worker
npx clayon token agent list --company-id <company-id> --agent <agent-id-or-name>
npx clayon token agent revoke --company-id <company-id> --agent <agent-id-or-name> <key-id>
```

Named board API keys use the board authorization model, support revocation and expiration metadata, and are audited server-side.

```sh
npx clayon token board create --company-id <company-id> --name external-admin
npx clayon token board create --name short-lived --ttl-days 7
npx clayon token board list
npx clayon token board revoke <key-id>
```

## Run Commands

`clayon run` without a subcommand still bootstraps and starts a local Clayon instance. The subcommands below inspect and control API heartbeat runs.

```sh
npx clayon run list --company-id <company-id> [--agent-id <agent-id>] [--limit 50]
npx clayon run live --company-id <company-id> [--limit 50] [--min-count 0]
npx clayon run get <run-id>
npx clayon run events <run-id> [--after-seq 0] [--limit 200]
npx clayon run log <run-id> [--offset 0] [--limit-bytes 16384] [--text]
npx clayon run cancel <run-id>
npx clayon run issues <run-id>
npx clayon run workspace-operations <run-id>
npx clayon run workspace-log <operation-id> [--offset 0] [--limit-bytes 16384] [--text]
npx clayon run watchdog-decision <run-id> --decision continue [--reason "..."]
```

## Routine Commands

`clayon routines disable-all` remains the local maintenance command. The singular `routine` group maps to the REST API.

```sh
npx clayon routine list --company-id <company-id> [--project-id <project-id>]
npx clayon routine create --company-id <company-id> --payload-json '{...}'
npx clayon routine get <routine-id>
npx clayon routine update <routine-id> --payload-json '{...}'
npx clayon routine revisions <routine-id>
npx clayon routine revision:restore <routine-id> <revision-id>
npx clayon routine runs <routine-id> [--limit 50]
npx clayon routine run <routine-id> [--payload-json '{...}']
npx clayon routine trigger:create <routine-id> --payload-json '{...}'
npx clayon routine trigger:update <trigger-id> --payload-json '{...}'
npx clayon routine trigger:delete <trigger-id>
npx clayon routine trigger:rotate-secret <trigger-id>
npx clayon routine trigger:fire <public-id> [--payload-json '{...}']
```

## Prompt Handoff

Prompt handoff creates Clayon work. It does not create a chat session.

```sh
npx clayon agent-prompt <agent-name-or-id> <agent-api-key> "Prompt here"
npx clayon agent prompt --agent <agent-name-or-id> --api-key-env CLAYON_API_KEY "Prompt here"
npx clayon agent prompt --profile my-agent "Prompt here"
npx clayon board prompt --company-id <company-id> --agent <agent-name-or-id> "Prompt here"
```

By default the command creates a `todo` issue assigned to the target agent and wakes the agent. Use `--issue <issue-id>` to add a comment to existing work, and `--no-wake` to skip the wakeup.

## Skills Commands

`clayon skills` covers three distinct operations:

1. **Company install** — adds or updates a row in `company_skills` for the
   whole company. This is what `skills install`, `skills import`, `skills create`,
   and `skills scan-projects` do.
2. **Agent attach** — merges an agent's *desired* company skill set with an
   explicit `add`, `remove`, or `replace` mode (`skills agent sync`/`clear`).
   This is a desired-state operation on the agent's adapter config; it does not
   change the company library.
3. **Adapter runtime sync** — the adapter reconciles the desired skill set
   with files on disk and reports an `AgentSkillSnapshot` (`skills agent list`).
   `skills agent sync` triggers this automatically after updating desired state.

Required Clayon runtime skills (heartbeat, etc.) remain server-enforced and
are added on top of whatever the desired set names.

Company skill mutations (`skills install`, `skills import`, `skills create`, and
`skills scan-projects`) are open to same-company actors by default. Missing
`skills:create` grants and `canCreateSkills` settings do not deny these commands;
only an explicit company skill policy restriction does. Core safety and company
boundary checks still apply, and `agents:create` remains required when a command
also creates agents.

### Catalog (app-shipped skills)

The Clayon app ships a curated catalog under `@clayon/skills-catalog`.
Browse and inspect commands never mutate company state; `install` adds a catalog
skill to the company library.

```sh
npx clayon skills browse [--kind bundled|optional] [--category <slug>] [--query <text>]
npx clayon skills search "<text>" [--kind bundled|optional] [--category <slug>]
npx clayon skills inspect <catalog-id-or-key-or-slug>
npx clayon skills install <catalog-id-or-key-or-slug> [--as <slug>] [--force] --company-id <company-id>
```

Catalog semantics:

- **Bundled** skills live in `packages/skills-catalog/catalog/bundled/<category>/<slug>`
  and are recommended defaults for most companies. They use canonical key
  `clayon/bundled/<category>/<slug>`.
- **Optional** skills live in `packages/skills-catalog/catalog/optional/<category>/<slug>`
  and are role-specific or domain-specific (browser, AWS ops, etc.). Same key
  shape with `optional` in place of `bundled`.
- `skills install` materializes the catalog files into a company-managed skill
  directory and records provenance (`catalogId`, `catalogKey`, `packageVersion`,
  `originHash`, …) so future updates and audit decisions stay consistent.
- `--as <slug>` overrides the company skill slug. `--force` may replace a
  same-key catalog-managed skill but never bypasses hard validation or hard-stop
  audit findings.

Examples:

```sh
npx clayon skills browse --kind bundled --company-id <company-id>
npx clayon skills search "pull request" --kind bundled
npx clayon skills inspect github-pr-workflow
npx clayon skills install github-pr-workflow --company-id <company-id>
npx clayon skills install clayon:optional:browser:agent-browser --company-id <company-id>
```

External GitHub, skills.sh, local-path, and URL sources still go through
`skills import`; catalog commands are for the app-shipped catalog only.

### Organization library

```sh
npx clayon skills list --company-id <company-id>
npx clayon skills show <skill-id-or-key-or-slug> --company-id <company-id>
npx clayon skills file <skill-id-or-key-or-slug> [--path SKILL.md] --company-id <company-id>
npx clayon skills import <source> --company-id <company-id>
npx clayon skills create --name "Review PRs" [--slug review-prs] [--description "..."] [--body-file SKILL.md] --company-id <company-id>
npx clayon skills scan-projects [--project-id <id>...] [--workspace-id <id>...] --company-id <company-id>
npx clayon skills check [skill-id-or-key-or-slug] --company-id <company-id>
npx clayon skills update <skill-id-or-key-or-slug> [--force] --company-id <company-id>
npx clayon skills update --all [--force] --company-id <company-id>
npx clayon skills audit [skill-id-or-key-or-slug] --company-id <company-id>
npx clayon skills reset <skill-id-or-key-or-slug> [--yes] [--force] --company-id <company-id>
npx clayon skills remove <skill-id-or-key-or-slug> --yes --company-id <company-id>
```

`skills import <source>` accepts a skills.sh URL, the equivalent
`<owner>/<repo>/<skill>` shorthand, a GitHub URL, a local path, or an
`npx skills add …` command. See `references/company-skills.md` in the agent
skill bundle for the source-type table.

`skills check`, `skills update`, `skills audit`, and `skills reset` are the
maintenance loop for catalog-installed skills:

- `check` reports whether each skill's installed bytes match its pinned origin
  (`hasUpdate`, `installedHash`, `originHash`, `updateHoldReason`,
  `auditVerdict`).
- `update` installs the pinned update through the existing install-update API.
  `--all` checks every company skill and updates only those with
  `hasUpdate=true`. `--force` discards local-modification or soft-audit holds;
  hard-stop audit findings still block the update.
- `audit` re-scans installed bytes and reports findings without executing
  anything.
- `reset` reinstalls a catalog-managed skill from its pinned origin, discarding
  local edits. Prompts in a TTY; requires `--yes` for non-interactive use.

### Agent attach

```sh
npx clayon skills agent list <agent-id-or-shortname> --company-id <company-id>
npx clayon skills agent sync <agent-id-or-shortname> --skill <skill-id-or-key-or-slug> [--skill <skill-id-or-key-or-slug>...] --mode <add|remove|replace> --company-id <company-id>
npx clayon skills agent clear <agent-id-or-shortname> --yes --company-id <company-id>
```

`skills agent sync` requires a merge mode and returns the resulting adapter
`AgentSkillSnapshot`. `add` preserves all unnamed assignments, `remove` deletes
only named assignments, and `replace` destructively overwrites the complete
non-required desired skill set.
`skills agent clear` sends an empty desired list. Required Clayon skills are
still enforced by the server in both cases.

### Notes

- Skill references accept company skill `id`, canonical `key`, or unique
  `slug`; catalog references accept catalog `id`, `key`, or unique `slug`.
- `skills file` prints raw file content in human mode so it can be piped.
- `skills create --body-file -` reads the skill markdown body from stdin.
- `skills remove`, `skills reset`, and `skills agent clear` prompt in a TTY and
  require `--yes` in non-interactive use.
- `--json` prints the raw API result for each command.

## Teams Commands

`clayon teams` works with the app-shipped team catalog in
`@clayon/teams-catalog`. Browse, search, inspect, and file reads do not
change company state. `preview` runs the company import planner, and `install`
imports the catalog team into an existing company.

```sh
npx clayon teams browse [--kind bundled|optional] [--category <slug>] [--query <text>]
npx clayon teams search "<text>" [--kind bundled|optional] [--category <slug>]
npx clayon teams inspect <catalog-id-or-key-or-slug> [--file TEAM.md]
npx clayon teams preview <catalog-id-or-key-or-slug> --company-id <company-id>
npx clayon teams install <catalog-id-or-key-or-slug> --company-id <company-id>
```

Preview/install options:

- Under agent authentication, use `clayon company list --json`,
  `clayon company current --json`, or `CLAYON_COMPANY_ID` to select the
  target company. `company list` falls back to the scoped current company when
  board-wide listing is forbidden. `teams install` creates agents and therefore
  requires board authentication, an `agents:create` grant, or an agent with the
  `canCreateAgents` permission (enabled by default for newly created
  standard-trust agents; low-trust agents and pre-existing agents without an
  explicit value stay disabled).
- `--request-approval-on-forbidden` turns a 403 install denial into a linked
  board approval request instead of a raw failed command; use
  `--approval-issue-id <id>` to attach it to a specific issue. During Clayon
  task runs with `CLAYON_TASK_ID` set, this fallback is automatic so
  agent-run walkthroughs leave a pending approval path instead of a raw 403.
- `--target-manager-agent-id <id>` or `--target-manager-slug <slug>` reparents
  catalog root agents under an existing manager.
- `--agent <slug>` and `--selected-file <path>` narrow the import.
- `--collision-strategy rename|skip|replace` controls name/key collisions.
- `--allow-external-sources`, `--allow-unpinned-optional-sources`, and
  `--allow-local-path-sources` explicitly opt into higher-trust source policy.
  Local-path sources are development-only and stay blocked unless that flag is
  passed.

## Secrets Commands

```sh
npx clayon secrets list --company-id <company-id>
npx clayon secrets declarations --company-id <company-id> [--include agents,projects] [--kind secret]
npx clayon secrets create --company-id <company-id> --name anthropic-api-key --value-env ANTHROPIC_API_KEY
npx clayon secrets link --company-id <company-id> --name prod-stripe-key --provider aws_secrets_manager --external-ref <provider-ref>
npx clayon secrets doctor --company-id <company-id>
npx clayon secrets provider-configs --company-id <company-id>
npx clayon secrets provider-config:create --company-id <company-id> --payload-json '{...}'
npx clayon secrets provider-config:discovery-preview --company-id <company-id> --payload-json '{...}'
npx clayon secrets provider-config:get <config-id>
npx clayon secrets provider-config:update <config-id> --payload-json '{...}'
npx clayon secrets provider-config:default <config-id>
npx clayon secrets provider-config:health <config-id>
npx clayon secrets provider-config:delete <config-id>
npx clayon secrets remote-import:preview --company-id <company-id> --payload-json '{...}'
npx clayon secrets remote-import --company-id <company-id> --payload-json '{...}'
npx clayon secrets migrate-inline-env --company-id <company-id> [--apply]
```

Secret listing and declarations never print secret values. `create` accepts
`--value-env` so shell history does not capture the value. `link` records
provider-owned references without copying the secret value into Clayon.
For AWS-backed secrets, `secrets doctor` reports missing non-secret provider
env and the expected AWS SDK runtime credential source; do not store AWS
bootstrap credentials in Clayon secrets.

Per-company provider vaults (multiple vault instances per provider, default
vault selection, coming-soon GCP/Vault) can be configured from the board UI under
`Organization Settings → Secrets → Provider vaults` or through the provider-config CLI
commands above. See the
[secrets deploy guide](../docs/deploy/secrets.md#provider-vaults) and
[API reference](../docs/api/secrets.md#provider-vaults) for the contract.

## Approval Commands

```sh
npx clayon approval list --company-id <company-id> [--status pending]
npx clayon approval get <approval-id>
npx clayon approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
npx clayon approval approve <approval-id> [--decision-note "..."]
npx clayon approval reject <approval-id> [--decision-note "..."]
npx clayon approval request-revision <approval-id> [--decision-note "..."]
npx clayon approval resubmit <approval-id> [--payload '{"...":"..."}']
npx clayon approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
npx clayon activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
npx clayon activity create --company-id <company-id> --payload-json '{...}'
npx clayon activity issue <issue-id>
```

## Dashboard Commands

```sh
npx clayon dashboard get --company-id <company-id>
```

## Org And Agent Config Commands

```sh
npx clayon whoami
npx clayon openapi
npx clayon org get --company-id <company-id>
npx clayon org svg --company-id <company-id> [--out org.svg]
npx clayon org png --company-id <company-id> [--out org.png]
npx clayon agent-config list --company-id <company-id>
```

## Access, Profile, And Instance Commands

```sh
npx clayon profile session
npx clayon profile get
npx clayon profile update --payload-json '{...}'
npx clayon profile company-user <user-slug> --company-id <company-id>
npx clayon invite list --company-id <company-id>
npx clayon invite create --company-id <company-id> --payload-json '{...}'
npx clayon invite revoke <invite-id>
npx clayon invite show <token>
npx clayon invite accept <token> [--payload-json '{...}']
npx clayon invite onboarding:text <token>
npx clayon join list --company-id <company-id> [--status pending_approval]
npx clayon join approve <request-id> --company-id <company-id>
npx clayon join reject <request-id> --company-id <company-id>
npx clayon join claim-key <request-id> --claim-secret <secret>
npx clayon member list --company-id <company-id>
npx clayon member update <member-id> --company-id <company-id> --payload-json '{...}'
npx clayon member role-and-grants <member-id> --company-id <company-id> --payload-json '{...}'
npx clayon member permissions <member-id> --company-id <company-id> --payload-json '{...}'
npx clayon member archive <member-id> --company-id <company-id> [--payload-json '{...}']
npx clayon admin user list [--query <text>]
npx clayon admin user promote <user-id>
npx clayon admin user demote <user-id>
npx clayon admin user company-access <user-id>
npx clayon admin user company-access:update <user-id> --payload-json '{...}'
```

CLI auth challenge endpoints are also exposed for tooling that needs the raw challenge lifecycle:

```sh
npx clayon auth challenge create --payload-json '{...}'
CLAYON_CHALLENGE_SECRET=<challenge-secret> npx clayon auth challenge get <challenge-id> --token-env CLAYON_CHALLENGE_SECRET
CLAYON_CHALLENGE_SECRET=<challenge-secret> npx clayon auth challenge approve <challenge-id> --token-env CLAYON_CHALLENGE_SECRET
CLAYON_CHALLENGE_SECRET=<challenge-secret> npx clayon auth challenge cancel <challenge-id> --token-env CLAYON_CHALLENGE_SECRET
npx clayon auth revoke-current
```

`--token <challenge-secret>` is still supported for compatibility, but `--token-env` avoids putting challenge secrets in shell history or process arguments.

Use the challenge UUID returned by `auth challenge create` for get, approve, and
cancel. With the required secret and approval authentication present, malformed
IDs return HTTP 400 before database access. A status request without a secret
returns HTTP 404. Unknown challenges or incorrect challenge secrets still return
HTTP 404. Approval requires board authentication, checked before ID validation.

## Instance Settings Commands

```sh
npx clayon instance scheduler-heartbeats
npx clayon instance settings:general
npx clayon instance settings:general:update --payload-json '{...}'
npx clayon instance settings:experimental
npx clayon instance settings:experimental:update --payload-json '{...}'
npx clayon instance database-backup
```

Experimental features are opt-in and are provided without compatibility guarantees. They may break, change, or be removed at any time. Use them at your own risk.

```sh
npx clayon sidebar preferences
npx clayon sidebar preferences:update --payload-json '{...}'
npx clayon sidebar project-preferences --company-id <company-id>
npx clayon sidebar project-preferences:update --company-id <company-id> --payload-json '{...}'
npx clayon sidebar badges --company-id <company-id>
npx clayon inbox dismissals --company-id <company-id>
npx clayon inbox dismiss --company-id <company-id> --payload-json '{"itemKey":"run:<run-id>"}'
npx clayon board-claim show <token>
npx clayon board-claim claim <token> [--payload-json '{...}']
npx clayon openclaw invite-prompt --company-id <company-id> --payload-json '{...}'
npx clayon available-skill list
npx clayon available-skill index
npx clayon available-skill get <skill-name>
npx clayon llm agent-configuration
npx clayon llm agent-configuration:adapter <adapter-type>
npx clayon llm agent-icons
```

Hermes gateway uses the generic invite/join commands above rather than
`openclaw invite-prompt`. Create an agent invite, read
`invite onboarding:text`, submit a join request with
`adapterType: "hermes_gateway"` and `agentDefaultsPayload.apiBaseUrl` /
`agentDefaultsPayload.apiKey`, then approve and claim the key with the `join`
commands. See [HERMES_GATEWAY_ONBOARDING.md](./HERMES_GATEWAY_ONBOARDING.md).

## Adapter, Asset, And Skill Commands

```sh
npx clayon adapter list
npx clayon adapter install --payload-json '{"packageName":"@scope/adapter","version":"1.2.3"}'
npx clayon adapter get <adapter-type>
npx clayon adapter update <adapter-type> --payload-json '{"disabled":true}'
npx clayon adapter override <adapter-type> --payload-json '{"paused":true}'
npx clayon adapter reload <adapter-type>
npx clayon adapter reinstall <adapter-type>
npx clayon adapter delete <adapter-type>
npx clayon adapter config-schema <adapter-type>
npx clayon adapter ui-parser <adapter-type>
npx clayon adapter models <adapter-type> --company-id <company-id> [--refresh] [--environment-id <id>]
npx clayon adapter detect-model <adapter-type> --company-id <company-id>
npx clayon adapter test-environment <adapter-type> --company-id <company-id> --payload-json '{...}'
```

```sh
npx clayon asset image:upload --company-id <company-id> --file ./image.png [--namespace docs] [--alt "..."]
npx clayon asset logo:upload --company-id <company-id> --file ./logo.svg
npx clayon asset content <asset-id> --out ./asset.bin
```

```sh
npx clayon skill list --company-id <company-id>
npx clayon skill get <skill-id> --company-id <company-id>
npx clayon skill file <skill-id> --company-id <company-id> [--path SKILL.md]
npx clayon skill create --company-id <company-id> --payload-json '{...}'
npx clayon skill file:update <skill-id> --company-id <company-id> --payload-json '{...}'
npx clayon skill import --company-id <company-id> --payload-json '{"source":"github:owner/repo/path"}'
npx clayon skill scan-projects --company-id <company-id> --payload-json '{...}'
npx clayon skill update-status <skill-id> --company-id <company-id>
npx clayon skill install-update <skill-id> --company-id <company-id>
npx clayon skill delete <skill-id> --company-id <company-id>
```

## Cost, Finance, And Budget Commands

```sh
npx clayon cost summary --company-id <company-id>
npx clayon cost by-agent --company-id <company-id>
npx clayon cost by-agent-model --company-id <company-id>
npx clayon cost by-provider --company-id <company-id>
npx clayon cost by-biller --company-id <company-id>
npx clayon cost by-project --company-id <company-id>
npx clayon cost window-spend --company-id <company-id>
npx clayon cost quota-windows --company-id <company-id>
npx clayon cost issue <issue-id>
npx clayon cost event:create --company-id <company-id> --payload-json '{...}'
```

```sh
npx clayon finance event:create --company-id <company-id> --payload-json '{...}'
npx clayon finance events --company-id <company-id>
npx clayon finance summary --company-id <company-id>
npx clayon finance by-biller --company-id <company-id>
npx clayon finance by-kind --company-id <company-id>
npx clayon budget overview --company-id <company-id>
npx clayon budget policy:upsert --company-id <company-id> --payload-json '{...}'
npx clayon budget company:update --company-id <company-id> --payload-json '{...}'
npx clayon budget agent:update <agent-id> --payload-json '{...}'
npx clayon budget incident:resolve <incident-id> --company-id <company-id> [--payload-json '{...}']
```

## Workspace And Environment Commands

```sh
npx clayon workspace list --company-id <company-id>
npx clayon workspace get <execution-workspace-id>
npx clayon workspace close-readiness <execution-workspace-id>
npx clayon workspace operations <execution-workspace-id>
npx clayon workspace update <execution-workspace-id> --payload-json '{...}'
npx clayon workspace runtime-service <execution-workspace-id> start --payload-json '{...}'
npx clayon workspace runtime-command <execution-workspace-id> run --payload-json '{...}'
```

```sh
npx clayon environment list --company-id <company-id>
npx clayon environment capabilities --company-id <company-id>
npx clayon environment create --company-id <company-id> --payload-json '{...}'
npx clayon environment get <environment-id>
npx clayon environment leases <environment-id>
npx clayon environment lease <lease-id>
npx clayon environment update <environment-id> --payload-json '{...}'
npx clayon environment delete <environment-id>
npx clayon environment probe <environment-id>
npx clayon environment probe-config --company-id <company-id> --payload-json '{...}'
```

```sh
npx clayon project-workspace list <project-id>
npx clayon project-workspace create <project-id> --payload-json '{...}'
npx clayon project-workspace update <project-id> <workspace-id> --payload-json '{...}'
npx clayon project-workspace delete <project-id> <workspace-id>
npx clayon project-workspace runtime-service <project-id> <workspace-id> restart --payload-json '{...}'
npx clayon project-workspace runtime-command <project-id> <workspace-id> run --payload-json '{...}'
```

## Plugin Commands

Existing plugin lifecycle commands remain available: `plugin init`, `list`, `install`, `uninstall`, `enable`, `disable`, `inspect`, and `examples`.

```sh
npx clayon plugin ui-contributions
npx clayon plugin tools
npx clayon plugin tool:execute --payload-json '{...}'
npx clayon plugin health <plugin-id>
npx clayon plugin logs <plugin-id>
npx clayon plugin upgrade <plugin-id>
npx clayon plugin config <plugin-id> --company-id <company-id>
npx clayon plugin config:set <plugin-id> --company-id <company-id> --payload-json '{"configJson":{...}}'
npx clayon plugin config:test <plugin-id> --company-id <company-id> --payload-json '{"configJson":{...}}'
npx clayon plugin jobs <plugin-id>
npx clayon plugin job:runs <plugin-id> <job-id>
npx clayon plugin job:trigger <plugin-id> <job-id> [--payload-json '{...}']
npx clayon plugin webhook <plugin-id> <endpoint-key> [--payload-json '{...}']
npx clayon plugin dashboard <plugin-id>
npx clayon plugin bridge:data <plugin-id> --payload-json '{...}'
npx clayon plugin bridge:action <plugin-id> --payload-json '{...}'
npx clayon plugin bridge:stream <plugin-id> <channel> [--duration-ms 10000]
npx clayon plugin data <plugin-id> <key> --payload-json '{...}'
npx clayon plugin action <plugin-id> <key> --payload-json '{...}'
npx clayon plugin local-folders <plugin-id> --company-id <company-id>
npx clayon plugin local-folder:status <plugin-id> <folder-key> --company-id <company-id>
npx clayon plugin local-folder:validate <plugin-id> <folder-key> --company-id <company-id> [--payload-json '{...}']
npx clayon plugin local-folder:set <plugin-id> <folder-key> --company-id <company-id> --payload-json '{...}'
```

Feedback traces can be fetched directly by ID when automating export workflows:

```sh
npx clayon feedback trace <trace-id>
npx clayon feedback bundle <trace-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
npx clayon heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Local Clayon data lives under the selected instance root. `CLAYON_HOME` chooses the home directory and `CLAYON_INSTANCE_ID` chooses the instance.

```text
~/.clayon/                                     # CLAYON_HOME
└── instances/
    └── default/                                  # instance root (CLAYON_INSTANCE_ID)
        ├── config.json                           # runtime config
        ├── .env                                  # instance env file
        ├── db/                                   # embedded PostgreSQL data
        ├── data/
        │   ├── storage/                          # local_disk uploads
        │   └── backups/                          # automatic DB backups
        ├── logs/
        ├── secrets/
        │   └── master.key                        # local_encrypted master key
        ├── workspaces/                           # default agent workspaces
        ├── projects/                             # project execution workspaces
        ├── companies/                            # per-company adapter homes (e.g. codex-home)
        └── codex-home/                           # per-instance codex home (when not company-scoped)
```

Default paths for the canonical install:

- config: `~/.clayon/instances/default/config.json`
- embedded db: `~/.clayon/instances/default/db`
- logs: `~/.clayon/instances/default/logs`
- storage: `~/.clayon/instances/default/data/storage`
- secrets key: `~/.clayon/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
CLAYON_HOME=/custom/home CLAYON_INSTANCE_ID=dev pnpm clayon run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm clayon configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
