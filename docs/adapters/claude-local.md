---
id: antl:clayon/docs/adapters/claude-local
title: Claude Code
summary: Claude Code local adapter setup and configuration
---

The `claude_local` adapter runs Anthropic's Claude Code CLI locally. Supports session persistence, skills injection, structured output parsing.

## Quota waits

Claude ACP runs ending with a typed provider-quota error keep the quota
classification and any parsed reset time. Recovery waits until that time, or
uses the existing one-hour quota backoff when no reset time is available.
Includes the Claude bridge's typed “The Claude account has no available
quota.” fallback, which carries no reset timestamp.
The adapter inspects the terminal provider message in memory; the run result
and run log keep only the generic failure message, recovery labels, and reset
timestamp. Context, turn, rate, and configured budget limits are not treated as
subscription quota exhaustion merely because ACP labels them `limit`.

## Prerequisites

- Claude Code CLI installed (`claude` command available)
- Either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` in adapter or
  environment env (or host env), or a Claude Code subscription login
  available to the execution target

## Configuration Fields

```text
[8]{Field,Type,Required,Description}:
  `cwd`,string,Yes,"Working directory for the agent process (absolute path; created automatically if missing when permissions allow)"
  `model`,string,No,"Claude model to use (default: `claude-opus-5`)"
  `promptTemplate`,string,No,Prompt used for all runs
  `env`,object,No,"Environment variables (supports secret refs)"
  `timeoutSec`,number,No,"Process timeout (0 = no timeout)"
  `graceSec`,number,No,Grace period before force-kill
  `maxTurnsPerRun`,number,No,"Max agentic turns per heartbeat (defaults to `300`)"
  `dangerouslySkipPermissions`,boolean,No,"Skip permission prompts (default: `true`); required for headless runs where interactive approval is impossible"
```

## Default model

An omitted, empty, or whitespace-only `model` uses Claude Opus 5
(`claude-opus-5`) on both CLI and ACP engines. Also applies to existing
agents with an unset model, including agents created through the API and agents
running in sandboxes. No database migration needed. The editor shows the
Clayon default and leaves the setting unset until you select a model.

An explicit `model` takes precedence over `ANTHROPIC_MODEL`; with only
`ANTHROPIC_MODEL` configured, the adapter keeps that override. Bedrock and
Vertex configurations without an explicit model keep their provider-specific
default — those providers use different model IDs. Host environment
settings apply only to local targets when resolving the model.

The default does not change explicitly configured agent models or the separate
Clayon Runner's qualified provider profiles.

## Prompt Templates

Templates support `{{variable}}` substitution:

```text
[5]{Variable,Value}:
  `{{agentId}}`,Agent's ID
  `{{companyId}}`,Company ID
  `{{runId}}`,Current run ID
  `{{agent.name}}`,Agent's name
  `{{company.name}}`,Company name
```

## Session Persistence

The adapter persists Claude Code session IDs between heartbeats. Next wake resumes the existing conversation so the agent retains full context.

Session resume is cwd-aware: if the agent's working directory changed since the last run, a fresh session starts instead.

On resume failure with an unknown-session error, the adapter automatically retries with a fresh session.

### Poisoned `previous_message_id` (recovery)

Symptom in logs / issue thread:

```
API Error: 400 diagnostics.previous_message_id: must be the `id` from a prior /v1/messages response (starts with `msg_`)
```

What it means: the on-disk Claude Code transcript JSONL contains a malformed (non-`msg_`-prefixed) `previous_message_id`. Anthropic's `/v1/messages` rejects every resume attempt against that transcript with a deterministic 400. Without guards, Clayon re-persists the same poisoned session id and the issue strands permanently — see RED-976 `com.clayon` / RED-978 `com.clayon`.

What the adapter does automatically:

1. **Auto-rotate on resume.** If a `--resume` attempt returns this 400, the adapter retries once with a fresh session, deletes the poisoned `<session>.jsonl` from the local Claude config dir (best effort), and uses the fresh session id going forward.
2. **Validate-before-persist.** A result that carries this 400 never gets its `session_id` written back to the task session store, even if Claude Code emits one in the result event. The adapter returns `sessionId: null`, `sessionParams: null`, and `errorCode: "claude_poisoned_previous_message_id"`.
3. **Clear-on-error.** The adapter sets `clearSession: true` on the result, which causes the heartbeat service to drop any persisted session row for that issue (`clearTaskSessions`). The next continuation starts from a clean slate.

On-call checklist if you see this in production:

- Confirm `errorCode` is `claude_poisoned_previous_message_id` in the run row — the guards fired correctly and the issue auto-recovers on the next heartbeat.
- If the same issue still loops after one heartbeat, check that `agentTaskSessions` for that `(agentId, taskKey)` was cleared. If not, the adapter return value was lost (e.g. a malformed run finalization) — escalate; do **not** manually edit the row, file a child issue with the run id.
- For remote execution targets (sandbox/SSH), the poisoned JSONL is on the remote and the adapter only logs cleanup intent. The fresh-session retry still succeeds (new session id), and server-side `clearSession: true` is authoritative regardless of remote disk state.

## Skills Injection

The adapter creates a temporary directory with symlinks to Clayon skills, passed via `--add-dir`. Skills discoverable without polluting the agent's working directory.

## Remote credential ownership

With no API key or `CLAUDE_CODE_OAUTH_TOKEN` configured,
`claude_local` uses a snapshot-owns-auth topology for managed sandbox
targets. On a sandbox target with no explicit
`CLAUDE_CONFIG_DIR`, Clayon creates a remote
`CLAUDE_CONFIG_DIR` under the run's Claude runtime directory. It uploads
sanitized host-side settings such as `settings.json` and `CLAUDE.md`; the
managed seed does not upload host Claude credential files.

After the seed is copied, the remote materialization command checks the
execution target's own `$HOME/.claude`. Each missing credential
file is copied (`.credentials.json` or `credentials.json`) from that remote home
into the managed `CLAUDE_CONFIG_DIR`. Credentials baked into the
sandbox image win for managed remote Claude runs.

Worked example: a sandbox image contains `$HOME/.claude/.credentials.json` from
its own Claude Code login. Clayon starts a managed remote `claude_local` run,
uploads only the sanitized config seed, and sets `CLAUDE_CONFIG_DIR` to the
remote runtime config path. The managed config has no credential file,
so the adapter copies the sandbox image's `$HOME/.claude/.credentials.json` into
that path before invoking Claude. The sandbox snapshot owns the credential for
the run.

This differs from `codex_local` `antl:clayon/docs/adapters/codex-local`, where a
Clayon-managed sandbox run uploads a host-owned `CODEX_HOME/auth.json`,
shadowing any Codex login already inside the sandbox image.

For manual local CLI usage outside heartbeat runs (e.g. running as `claudecoder` directly):

```sh
npx clayon agent local-cli claudecoder --company-id <company-id>
```

Installs Clayon skills in `~/.claude/skills`, creates an agent API key, and prints shell exports to run as that agent.

## Environment Test

Use the "Test Environment" button in the UI to validate the adapter config. It checks:

- Claude CLI is installed and accessible
- Working directory is absolute and available (auto-created if missing and permitted)
- API key/auth mode hints (`ANTHROPIC_API_KEY` vs `CLAUDE_CODE_OAUTH_TOKEN` vs subscription login)
- A live hello probe (`claude --print - --output-format stream-json --verbose` with prompt `Respond with hello.`) to verify CLI readiness

The probe sees the same layered env as a real run: with an environment
selected, its variables (secret refs included) resolve and
merge under the adapter config's `env`, so environment-level auth shows
in the test result. A missing secret binding surfaces as
`environment_env_binding_missing` instead of a silently passing
probe.
