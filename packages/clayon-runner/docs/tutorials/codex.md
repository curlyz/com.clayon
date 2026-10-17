---
id: antl:clayon/packages/clayon-runner/docs/tutorials/codex
---

# Codex: Run the Skillless Codex Driver

## What this phase is

Codex connects the mock core to a real Codex app-server session.

One small task envelope. No Clayon skill.
No Clayon API key or API instructions.

## What this phase proves

A real Codex session can create a file, stream typed
events, return one checked result, and replay the same result.

Steer, interrupt, resume, and unsupported-operation paths
keep clear session identities and safe diagnostics.

## Before you start

- Run commands from the repository root.
- Install Node.js 20+, Bun 1.4+, Rust, and the `codex` CLI.
- Sign in to Codex with the normal local Codex setup.
- Add no Clayon or OpenAI API key for this tutorial.

Check the installed harness:

```sh
codex --version
codex app-server --help
```

Run real-Codex steps from an ordinary operator shell with a workspace that
has no `AGENTS.md` in that directory or any ancestor. A child directory of this
repository is not skillless: Codex discovers the repository
`AGENTS.md`. In a Clayon-managed agent run, `CLAYON_WORKSPACE_CWD` also
prevents `mktemp -d` from selecting a directory outside the assigned workspace;
use a separate clean operator workspace, never bypass that guard.

## Step 1: Run the focused conformance checks

```sh
bun run --filter @clayon/clayon-runner typecheck:typescript
bun x vitest run \
  src/drivers/codex/app-server-transport.test.ts \
  src/drivers/codex/codex-app-server-driver.test.ts
bun run --filter @clayon/clayon-runner check:forbidden-imports
```

Confirm driver tests pass and the package boundary check prints
`Standalone boundary check passed.`

## Step 2: Run the safe real Codex task

Choose a temporary directory and trace file:

```sh
codex_workspace="$(mktemp -d)"
codex_trace="$codex_workspace/trace.json"
bun run --filter @clayon/clayon-runner trace:codex -- \
  --working-directory "$codex_workspace" \
  --output "$codex_trace"
```

Confirm:

- the result is `done`;
- every printed assertion says `PASS`;
- the file has the exact text:

```sh
test "$(cat "$codex_workspace/hello.txt")" = "hello from Codex runner"
```

## Step 3: Inspect the exact model boundary

Clayon sends its runtime instructions as additive `developerInstructions`
on Codex thread start and resume. Codex keeps its stock base instructions.
Historical `context.baseInstructions` trace field contains the Clayon
fragment, not the full Codex base prompt. Driver option of the same name
supplies the same additive fragment.

Threads created before this change keep their saved replacement base prompt
on resume. Reset those provider sessions to apply the stock base instructions;
adding developer instructions never repairs an already saved base prompt.
This change never alters session recovery nor resets active sessions automatically.

```sh
jq '.context | {
  protocolVersion,
  codexVersion,
  model,
  modelProvider,
  workingDirectory,
  sandbox,
  approvalPolicy,
  baseInstructions,
  instructionSources,
  instructionPolicy,
  environmentKeys,
  dynamicToolNames,
  modelInputKinds,
  envelope
}' "$codex_trace"
```

Confirm:

- `instructionSources` is empty;
- all three instruction-policy values are `false`;
- `modelInputKinds` contains only `text`;
- the semantic tools are `clayon_finish` and `clayon_block`;
- no environment **value** is present;
- the requested permission profile denies root and host-home access, exposes
  read-only minimal runtime files, grants write access to the assigned
  workspace, and disables network access;
- the returned legacy sandbox facts are inspected separately because Codex may
  add provider-managed state roots such as `~/.codex/memories` even when memory
  instructions are disabled;
- command `HOME` and `CODEX_HOME` are absent;
- the envelope contains only this safe task and its completion criteria.

Check that no control-plane route or bearer credential appears:

```sh
if rg -ni 'authorization: bearer|clayon_api_key|/api/issues/' "$codex_trace"; then
  echo "FAIL: forbidden control-plane context found"
  exit 1
fi
```

## Step 4: Inspect canonical events and replay

```sh
jq '[.events[].eventType] | group_by(.) | map({type: .[0], count: length})' \
  "$codex_trace"
jq '.assertions' "$codex_trace"
```

Confirm:

- session and turn lifecycle events exist;
- model, command/tool, usage, verification, result, and terminal events exist;
- `exactlyOneTerminalResult` is `true`;
- `liveReplayParity` is `true`;
- source sequence and item identity assertions are `true`.

Focused test suite supplies deterministic file-change and runtime-request
events: a real model may choose a shell command instead of a file patch
and may not need human input for this small task.

## Step 5: Try steering

Use a new directory:

```sh
codex_steer_workspace="$(mktemp -d)"
bun run --filter @clayon/clayon-runner trace:codex -- \
  --working-directory "$codex_steer_workspace" \
  --steer "Keep the answer short and verify the exact file text."
```

Confirm that the same driver and provider session IDs are printed and the task
still returns one result.

## Step 6: Try interruption

Use a new directory:

```sh
codex_interrupt_workspace="$(mktemp -d)"
bun run --filter @clayon/clayon-runner trace:codex -- \
  --working-directory "$codex_interrupt_workspace" \
  --interrupt
```

An interrupt can win before file creation. Expected. Confirm the
trace still has one session identity, one semantic result, one terminal
event. Never create a replacement session.

## Step 7: Run the package verification path

```sh
bun run --filter @clayon/clayon-runner verify
```

Package acceptance path. Real Codex example stays a separate command:
automated environments may lack a signed-in Codex session.

## Step 8: Read the driver reference

- Codex driver reference `antl:clayon/packages/clayon-runner/docs/codex-driver`
