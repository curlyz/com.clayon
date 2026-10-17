---
id: antl:clayon/docs/guides/board-operator/execution-workspaces-and-runtime-services
title: Execution Workspaces And Runtime Services
summary: How project runtime configuration, execution workspaces, and issue runs fit together
---

The intended runtime model for projects, execution workspaces, and issue runs in Clayon.

Clayon presents this as a workspace-command model:

- `Services` — long-running commands, supervised.
- `Jobs` — one-shot commands, run once and exit.
- Raw runtime JSON remains available for advanced config, but is no longer the primary mental model.

## Project runtime configuration

Define how to run a project on the project workspace itself.

- Project workspace runtime config describes the services and jobs available for that project checkout.
- It is the default runtime configuration child execution workspaces may inherit.
- Defining the config starts nothing by itself.

## Runtime control: manual and heartbeat-driven

Workspace commands are UI-controlled manually; heartbeat runs also start services automatically.

- Project workspace services start/stop from the project workspace UI; project jobs run on demand there.
- Execution workspace services start/stop from the execution workspace UI; execution-workspace jobs run on demand there.
- Heartbeat runs also auto-start the workspace's runtime services at the beginning of an issue run. `ensureRuntimeServicesForRun` (`server/src/services/workspace-runtime.ts`, called from `server/src/services/heartbeat.ts`) starts each service whose desired state resolves to `running` — the default when no explicit per-service desired state is set. A running service matching an existing reuse key is reused, never restarted.
- Opt a service out of auto-start: desired state `stopped`/`manual` in the runtime config; those services stay UI-controlled.
- Clayon never auto-restarts workspace services on server boot — services return only when the next run (or a manual start) brings them up.

## Execution workspace inheritance

Execution workspaces isolate code and runtime state from the project primary workspace.

- An isolated execution workspace has its own checkout path, branch, and local runtime instance.
- Runtime configuration may inherit from the linked project workspace by default.
- The execution workspace may override that runtime configuration with workspace-specific settings.
- The inherited configuration answers "which commands exist and how to run them"; any running service process stays specific to that execution workspace.

## Issues and execution workspaces

Issues attach to execution workspace behavior, never to automatic runtime management.

- Isolated workspace mode: an issue may create a new execution workspace.
- Reuse mode: an issue may reuse an existing execution workspace.
- Multiple issues may intentionally share one execution workspace — same branch, same running runtime services.
- Running an issue auto-starts the workspace's `running`-desired runtime services for the run's duration (see "Runtime control" above); the run never stops them at its end unless they are ephemeral and no other run holds a lease.

## Execution workspace lifecycle

Execution workspaces are durable until a human closes them.

- The UI can archive an execution workspace.
- Closing one stops its runtime services and cleans up workspace artifacts when allowed.
- Shared workspaces pointing at the project primary checkout get more conservative cleanup than disposable isolated workspaces.

## Resolved workspace logic during heartbeat runs

Heartbeat resolves a workspace for the run (code location, session continuity) and brings up that workspace's runtime services.

1. Heartbeat resolves a base workspace for the run.
2. Clayon realizes the effective execution workspace, creating or reusing a worktree when needed.
3. Clayon persists execution-workspace metadata: paths, refs, provisioning settings.
4. Heartbeat passes the resolved code workspace to the agent run.
5. Heartbeat calls `ensureRuntimeServicesForRun` to start the workspace's `running`-desired runtime services, running the lazy runtime provision command first if one is configured and has not yet run (see "Lazy runtime provisioning" below).

## Browser-reachable origins for OAuth QA

A managed service running Clayon itself needs one canonical origin for Better Auth and tool OAuth callbacks. Resolution order:

1. Explicit service/runtime configuration such as `CLAYON_PUBLIC_URL` or `BETTER_AUTH_URL`.
2. An explicit instance auth public base URL.
3. The managed service's rendered `expose.urlTemplate`, injected as a low-priority runtime fallback.

The exposed URL must describe the route the operator's browser actually uses. Non-loopback callbacks require HTTPS. Loopback HTTP such as `http://127.0.0.1:45439` is supported for local browser QA. A non-loopback hostname rendered from workspace data must stay inside the stable domain suffix configured by `expose.urlTemplate`; branch names never replace that domain. Bind addresses, internal-only single-label names such as `clayon-dev`, reserved/non-resolving names, and non-loopback HTTP origins fail service startup with configuration guidance instead of silently producing an unusable redirect URI.

Proxy or tailnet route fronting the process: keep readiness and browser exposure separate:

```json
{
  "name": "clayon-dev",
  "command": "bun run dev --bind lan",
  "port": { "type": "auto" },
  "readiness": {
    "type": "http",
    "urlTemplate": "http://127.0.0.1:{{port}}"
  },
  "expose": {
    "type": "url",
    "urlTemplate": "https://{{workspace.branchName}}.dev.example.com"
  }
}
```

Use a distinct reachable hostname (or other distinct origin) per isolated worktree. Never point multiple worktree runtimes at the parent instance's origin. After startup, open the service URL in the same browser session used for QA and verify `GET /api/tools/oauth/client-metadata`; its `redirect_uris` entry should use that service origin and `/api/tools/oauth/callback`.

## Lazy runtime provisioning

Some workspaces need heavy one-time setup — seeding a database, warming caches — before their runtime services can start. Defer that work to the first runtime-service start instead of running it eagerly during workspace preparation.

- Configure a **runtime provision command** on the project's workspace strategy (Project properties → execution workspace), or override per execution workspace on the workspace's Configuration tab.
- When set, workspace preparation stays lean and the command runs exactly once, immediately before the first runtime-service start for that workspace. Empty keeps the legacy eager path (all setup during workspace provisioning).
- The command's outcome is recorded as a `workspace_runtime_provision` operation on the execution workspace, surfaced on the workspace detail page:
  - **Deferred** — configured, not yet run (no runtime service started yet).
  - **Provisioned at &lt;time&gt;** — command completed successfully.
  - **Provisioning failed** — command failed; the workspace detail links to the runtime logs for the failing operation.
- While the command runs, the runtime service shows a **Provisioning…** state before starting/running.

## Private repositories and repo-only project workspaces

A project workspace can be **repo-only**: a `Repo URL` with no local path. The server then
materializes a managed checkout on demand (`git clone` into a managed directory) and, for
isolated `git_worktree` runs, refreshes the base ref (`git fetch`) before preparing each
worktree. Both operations run on the server, outside any agent process — agent-scoped
credential env bindings never apply to them.

**Private GitHub repositories**: store a token as a **company secret** named one of
`GITHUB_TOKEN`, `GH_TOKEN`, or `CLAYON_GITHUB_TOKEN` (checked in that order; Settings →
Secrets). The server resolves it per run and authenticates managed clones and base-ref
fetches with it. Details and caveats:

- Scope: only `https://github.com/...` repo URLs authenticate this way. SSH URLs, GitHub
  Enterprise hosts, and other providers keep ambient behavior (system git config/credential
  helpers on the server host). URLs embedding their own credentials are never overridden.
- Fallback: no matching company secret — the server falls back to a `GITHUB_TOKEN` or
  `GH_TOKEN` variable in the **server process environment** (useful for self-hosted single-tenant
  deployments), then to unauthenticated access — public repos keep working with no setup.
- The token never appears in command lines, URLs, or on disk; it reaches git through an
  ephemeral credential helper. Each resolution records a secret access event.
- Separate from the **agent push credential**: agents pushing branches/PRs still need
  `GH_TOKEN`/`GITHUB_TOKEN` bound at agent or project scope (see
  deploy/secrets `antl:clayon/docs/deploy/secrets`) so the token reaches the agent process env. The
  same company secret can back both uses via a binding.

## Cross-run persistence (no-remote-git contract)

Code state moves between runs through the local execution-workspace cwd alone — never through a git remote.

- Each run's prepare step bundles the local worktree to the run's remote dir over ssh, no `git remote` configured.
- Other project repositories under `.clayon-repositories/` make the same round trip, each bundled and restored as its own Git checkout.
- The adapter's restore step at run end writes any new remote commits back into the local worktree directly.
- Adapters must never `git push` from runtime code, and must never assume a remote exists.
- A failed restore is a run-level error recording `workspace_finalize=failed` on the execution workspace, gating dependent issue wakes until the next successful finalize.

The invariant is enforced by the "no-remote-git contract" case in `packages/adapter-utils/src/ssh-fixture.test.ts`, asserting a remote-only commit reaches the local worktree with no remote configured at any point.

## Current implementation guarantees

Current implementation:

- Project workspace command config is the fallback for execution workspace UI controls.
- Execution workspace runtime overrides are stored on the execution workspace.
- Heartbeat runs auto-start the workspace's `running`-desired runtime services (via `ensureRuntimeServicesForRun`); `stopped`/`manual` services stay UI-controlled.
- A configured runtime provision command runs once, lazily, before the first runtime-service start.
- Server startup never auto-restarts workspace services.
