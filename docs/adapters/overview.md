---
id: antl:clayon/docs/adapters/overview
title: Adapters Overview
summary: What adapters are and how they connect agents to Clayon
---

Adapters bridge Clayon's orchestration layer and agent runtimes. Each adapter invokes one AI agent type and captures its results.

## How Adapters Work

When a heartbeat fires, Clayon:

1. Looks up the agent's `adapterType` and `adapterConfig`
2. Calls the adapter's `execute()` function with the execution context
3. The adapter spawns or calls the agent runtime
4. The adapter captures stdout, parses usage/cost data, and returns a structured result

## Built-in Adapters

```text
[12]{Adapter,Type Key,Description}:
  "Claude Code `antl:clayon/docs/adapters/claude-local`",`claude_local`,"Runs Claude Code CLI locally, with a native ACP engine when available"
  "Codex `antl:clayon/docs/adapters/codex-local`",`codex_local`,"Runs OpenAI Codex CLI locally, with a native ACP engine when available"
  "Gemini CLI `antl:clayon/docs/adapters/gemini-local`",`gemini_local`,"Runs Gemini CLI locally (experimental — adapter package exists, not yet in stable type enum)"
  "Kimi Code CLI `antl:clayon/docs/adapters/kimi-local`",`kimi_local`,"Runs Kimi Code CLI locally through ACP, with explicitly selectable headless `-p` mode"
  OpenCode,`opencode_local`,"Runs OpenCode CLI locally (multi-provider `provider/model`)"
  Cursor,`cursor`,Runs Cursor in background mode
  Pi,`pi_local`,Runs an embedded Pi agent locally
  Hermes,`hermes_local`,"Runs the local Hermes CLI through `@clayon/hermes-clayon-adapter`"
  Hermes Gateway,`hermes_gateway`,"Calls an already-running Hermes API server through `@clayon/hermes-clayon-adapter/gateway`"
  OpenClaw Gateway,`openclaw_gateway`,Connects to an OpenClaw gateway endpoint
  "Process `antl:clayon/docs/adapters/process`",`process`,Executes arbitrary shell commands
  "HTTP `antl:clayon/docs/adapters/http`",`http`,Sends webhooks to external agents
```

## Credential ownership for sandbox targets

Local CLI adapters run on the Clayon host, SSH targets, or managed
sandbox targets. The adapter picks the authoritative credential home
before the CLI starts:

| Adapter | Credential topology | Which credential file wins on managed sandbox targets |
|---------|---------------------|-------------------------------------------------------|
| `codex_local` `antl:clayon/docs/adapters/codex-local` | Host-owns-auth for Clayon-managed `CODEX_HOME` | A host-owned `auth.json` is symlinked into the managed `CODEX_HOME` and uploaded to the sandbox. If a per-agent `OPENAI_API_KEY` is configured, Clayon writes an API-key `auth.json` instead and that file wins. A login baked into the sandbox image is shadowed because Codex runs with Clayon's uploaded `CODEX_HOME`. |
| `claude_local` `antl:clayon/docs/adapters/claude-local` | Snapshot-owns-auth for managed remote Claude config | A configured `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (agent or environment env) wins over any stored login. Otherwise Clayon uploads only sanitized settings and skill/runtime assets, and when the remote managed config has no Claude credential files it copies `.credentials.json` or `credentials.json` from the sandbox image's own `$HOME/.claude`, so the image's login wins. |

Worked examples:

- **Codex sandbox with host ChatGPT login:** the host `~/.codex/auth.json`
  is symlinked into the managed home, then uploaded as the sandbox
  `CODEX_HOME`. Codex reads that uploaded file, not any `auth.json`
  already inside the sandbox image.
- **Claude sandbox with image login:** Clayon materializes a remote
  `CLAUDE_CONFIG_DIR`, then fills missing `.credentials.json` /
  `credentials.json` from the sandbox image's own `$HOME/.claude`. The
  snapshot's Claude login is the credential source for the run.

### Hermes local vs gateway

Use `hermes_local` when Clayon starts the local `hermes` CLI on the
same host per heartbeat. Use `hermes_gateway` when Hermes already
runs as an HTTP/SSE API server and Clayon should call it instead of
spawning a process. Both type keys are stable built-ins.

The unified Hermes package owns both built-in adapters. Older
`@clayon/adapter-hermes-gateway` remains only as a deprecated
compatibility shim re-exporting the gateway entrypoints for one release.
New plugin overrides target `@clayon/hermes-clayon-adapter` with the
desired type key (`hermes_local` or `hermes_gateway`).

### External (plugin) adapters

These adapters ship as standalone npm packages, installed via the plugin system:

| Adapter | Package | Type Key | Description |
|---------|---------|----------|-------------|
| Droid | `@henkey/droid-clayon-adapter` | `droid_local` | Runs Factory Droid locally |

## External Adapters

Build and distribute adapters as standalone packages — no Clayon source changes required. Loaded at startup via the plugin system.

```sh
# Install from npm via API
curl -X POST http://localhost:3102/api/adapters \
  -d '{"packageName": "my-clayon-adapter"}'

# Or link from a local directory
curl -X POST http://localhost:3102/api/adapters \
  -d '{"localPath": "/home/user/my-adapter"}'
```

See External Adapters `antl:clayon/docs/adapters/external-adapters` for the full guide.

## Adapter Architecture

Each adapter is a package with modules consumed by three registries:

```
my-adapter/
  src/
    index.ts            # Shared metadata (type, label, models)
    server/
      execute.ts        # Core execution logic
      parse.ts          # Output parsing
      test.ts           # Environment diagnostics
    ui-parser.ts        # Self-contained UI transcript parser (for external adapters)
    cli/
      format-event.ts   # Terminal output for `clayon run --watch`
```

- **Server** — Executes agents, captures results — `createServerAdapter()` from package root
- **UI** — Renders run transcripts, provides config forms — `ui-parser.js` (dynamic) or static import (built-in)
- **CLI** — Formats terminal output for live watching — Static import

## Choosing an Adapter

- **Need a coding agent?** Use `claude_local`, `codex_local`, `opencode_local`, `hermes_local`, or install `droid_local` as an external plugin
- **Need the richest live run feedback?** Use `claude_local`, `codex_local`, or `gemini_local` with `adapterConfig.engine` set to `acp` when the execution environment satisfies the ACP prerequisites — see Feedback granularity
- **Need Hermes on another host or already running as a service?** Use `hermes_gateway`
- **Need to run a script or command?** Use `process`
- **Need to call a custom external service?** Use `http`
- **Need something custom?** Create your own adapter `antl:clayon/docs/adapters/creating-an-adapter` or build an external adapter plugin `antl:clayon/docs/adapters/external-adapters`

## Feedback Granularity

Adapter choice determines how much structured, live detail a transcript shows while the agent works. Every adapter's stdout streams to the run log and renders live in the UI — sandbox runs included, logs tailed and delivered incrementally — but the *granularity* depends on the event stream the adapter emits.

Rough tiers, richest first:

1. **Native ACP engine (`claude_local`, `codex_local`, or `gemini_local` with `engine: "acp"`) — full structured event stream.** ACP emits a JSONL event per meaningful runtime moment: `acpx.session` (agent, mode, session identity), `acpx.status` (progress text plus context-window usage), `acpx.text_delta` (assistant/thinking token deltas), `acpx.tool_call` (tool title, call id, and status updates as the call progresses), `acpx.result` (stop reason summary), and `acpx.error` (code, message, retryability). The transcript renders these as live-updating message, thinking, tool, and status blocks; repeated `acpx.tool_call` status updates fold into one tool card instead of stacking duplicates.
2. **CLI wrappers (`claude_local`, `codex_local`, `cursor`, `opencode_local`, …).** These parse each CLI's own streaming JSON output. You get assistant text, tool calls/results, and a final usage/cost summary; granularity is limited to what the CLI prints — some emit tool progress, others only call/finish pairs.
3. **Generic adapters (`process`, `http`).** Plain stdout/stderr lines, no structured transcript — raw output only.

**Recommendation:** use the native ACP engine on `claude_local`, `codex_local`, or `gemini_local` when the selected execution environment supports it. Rich ACP status events (including context usage) and incremental tool-call updates come closest to watching the agent work locally.

## UI Parser Contract

External adapters can ship a self-contained UI parser telling the Clayon web UI how to render their stdout. Without it, the UI uses a generic shell parser. See UI Parser Contract `antl:clayon/docs/adapters/adapter-ui-parser` for details.

### Cursor failure details

The Cursor CLI adapter uses structured error output first, then the first
nonempty diagnostic line. It skips the informational `cursor-retrieval: tracing
to ...` file-location notice. If the CLI exits unsuccessfully with only that
notice, the run shows the exit code. Original stdout and stderr stay in
the local run result and log for troubleshooting. Environment probes use the
same diagnostic selection. No change to retry or success decisions.
