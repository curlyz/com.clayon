---
id: antl:clayon/packages/clayon-runner/docs/tutorials/scenario-chat
---

# Scenario chat Tutorial: Chat With the Mock Control Plane

**Time to first success: about 3 minutes.** One command opens a chat: send
prompts to a Capability scenario, watch exactly how the mock Clayon
control plane was used on every turn. Runs from the repository
root. Starts no Clayon service, contacts no Clayon control plane,
holds no provider credential.

Scenario chat extends the Capability browser surface; no runner integration
into Clayon. Real integration is future upload integration and requires separate approval. See
the future binding boundary reference `antl:clayon/packages/clayon-runner/docs/capability-future-binding-boundary`.

## What you need

- Node.js 20 or newer and pnpm 9 or newer. Verified with Node 22.22.2.
- No Rust toolchain and no network access after `pnpm install`.

Install the package workspace from the repository root:

```sh
pnpm install --filter @clayon/clayon-runner --lockfile=false --offline --ignore-scripts --dev
```

## 1. Open the chat (about 1 minute)

```sh
pnpm --filter @clayon/clayon-runner run demo:scenarios
```

Open <http://127.0.0.1:4183/scenario-explorer/#/chat/ap-mcp-gate-01>.

Before you type anything, the conversation already has content: a **session
seed** strip reading "Control plane checked out the task and opened the run — no
agent tool exists for this," plus a **Session seed activity** strip counting what
it did. That is the point of turn 0: work happened, no agent tool
involved.

Session status chip reads **Idle · seeded**. Right rail — **Activity**
on desktop, **Activity** segment on a phone — shows the seed group: its
exposure decision, state diff, verdict.

## 2. Run a turn that succeeds

Type into the composer and press Enter:

```
Where does the MCP tool approval for this task stand?
```

Turn appends: your message as a right-aligned bubble, two semantic calls
(`get_task_context`, `list_approvals`) as tool cards with disposition
badges, the agent's reply, a **Turn 1 activity** strip:

```
Turn 1 activity   ⚙ 2 tools   ⌘ 0 control plane   Δ 0 domains   ✓ Pass
```

Click the strip. Activity stream opens turn 1's group with the six evidence
sections in order — exposed tools, calls and results, authorization, control
plane, state diff, parity. Nothing changed state; the diff says so.

## 3. Run a turn that is denied

```
Raise the approval request yourself and get the tool switched on.
```

`request_approval` is denied. Denial renders in place on the danger surface:
failing operation, code `policy_denied`, reason
`required_claim_missing`, explicit line that **no protected state was
returned**. Turn strip counts it (`✕ 1 denied`); mobile Activity
segment carries a `· 1 deny` chip so you see it without opening the segment.

Session status still reads **Scripted · deterministic**; session
parity still passes. A denial is a correct outcome, not a broken session — this
run does not hold `governance:approvals:request`. Open the turn's
**Authorization** section for the claims considered and the missing one.

## 4. See control-plane-owned work with no agent tool

Open <http://127.0.0.1:4183/scenario-explorer/#/chat/ix-checkbox-01?replay=fake>.
`replay=fake` plays the recorded three-turn conversation.

Turn 2 opens a checkbox interaction. Turn 3 is the board answering it — and
that answer is performed by the control plane, not by a tool:

```
⌘ Control plane recorded the board's answer and scheduled the continuation
  wake — no agent tool exists for this.
```

Open turn 3's **State diff** section. `interactions` domain shows
`status: pending → answered`; unchanged domains collapse to one line; a
**Control plane** badged row records `wake.scheduled`. Reconciliation scheduled
the wake; the agent never asked for it.

## 5. Reset and replay

**Reset session** asks first: it discards mutable mock state. Accept and
the transcript returns to seeded turn 0 — no turns, no denials, clean
diff. Switching scenario from the rail mid-session asks the same question:
two scenarios never share mock state.

**Replay scripted session** plays remaining recorded turns, needs no
confirmation: reproduces an identical timeline.

## 6. Run the tests and record the evidence

```sh
pnpm --filter @clayon/clayon-runner run test:scenarios
pnpm --filter @clayon/clayon-runner run test:browser:scenarios
# Recorded evidence generation is deferred from this release.
```

First covers the session data contract and chat components; second
drives the surface in a real browser at both viewports; third writes the
ten acceptance screenshots to `.clayon-local/evidence/capability/` — failing if any
route scrolls horizontally.

## What this does not do

- No ACPX implementation and no real control-plane integration.
- No provider credential in the browser. **Codex (bounded)** stays disabled with
  a named reason unless the local provider relay runs; **Scripted
  (deterministic)** drives the same mock core offline.
- Nothing you type is persisted. Reload drops an unsent draft — the
  accepted trade against storing conversation content.

Reference: Scenario chat scenario chat `antl:clayon/packages/clayon-runner/docs/scenario-chat`.
