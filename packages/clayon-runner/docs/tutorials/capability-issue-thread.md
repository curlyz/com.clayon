---
id: antl:clayon/packages/clayon-runner/docs/tutorials/capability-issue-thread
---

# Capability Clean-Start Tutorial: The Clayon-Style Issue Thread Over a Mock Control Plane

**Time to first success: about 5 minutes.** Two commands take a clean
checkout to 106 passing conformance cases and a Clayon-style issue thread you
can click through in a browser. Runs from the repository
root. Starts no Clayon service, contacts no Clayon control plane, clones
no external eval repository, holds no provider credential. Everything the
default path needs is checked in under `packages/clayon-runner/`.

Canonical Capability tutorial for the final build. Covers both agent
modes: **scripted (deterministic) fake mode**, fully offline, and
**Codex (bounded) live mode**, optional, needs a locally
authenticated Codex. Both modes share one mock control plane, one semantic
tool catalog, one authorization engine, one view contract. See
execution modes and identity `antl:clayon/packages/clayon-runner/docs/capability-execution-modes` for the rules that
separate them, and the future binding boundary `antl:clayon/packages/clayon-runner/docs/capability-future-binding-boundary`
for why none of this touches real Clayon — that is future upload integration and needs separate
approval.

Deeper tour of the read-only scenario explorer and the capability
contract: companion
scenario-explorer tutorial `antl:clayon/packages/clayon-runner/docs/tutorials/capability-scenario-explorer`; this page focuses
on the issue-thread surface and the live loop.

## What you need

- Node.js 20 or newer and Bun 1.4 or newer. This tutorial was verified with Node
  22.22.2.
- No Rust toolchain for the fake-mode steps (steps 1–4). The optional live steps
  (step 5) build the `clayon-runnerd` binary and need a Rust toolchain and a
  locally authenticated Codex.
- No network access after `bun install`.

Install the package workspace from the repository root:

```sh
NODE_ENV=development bun install --filter @clayon/clayon-runner --frozen-lockfile --ignore-scripts
```

Checked-in lockfile stays authoritative; uses only packages
already present in the Bun install cache, so the offline install never re-resolves
dependencies to registry-latest versions. `NODE_ENV=development`
ensures the complete test toolchain installs even when the checkout
inherits `NODE_ENV=production`.

## 1. Prove the 106-case conformance suite (about 1 minute)

```sh
bun run --filter @clayon/clayon-runner test:capability-evals
```

Drives all 106 eval-derived cases across the 16 groups entirely in-process
against the mock control plane. Expected final line:

```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

For the per-group counts, assertion classes, the 18-operation fake-agent matrix,
and the 16-case bounded Codex binding sample, generate the parity report:

```sh
bun run --filter @clayon/clayon-runner report:capability-evals
```

Expected final line:

```
Capability eval conformance passed: 106 cases across 16 groups.
```

Report writes to `.clayon-local/evidence/capability/eval-parity-report.{json,md}`.
Generated on demand, not committed; delete it before running
`docs:validate`, or run validation first.

## 2. Run the issue-thread contract and UI tests (about 1 minute)

```sh
bun run --filter @clayon/clayon-runner test:scenarios
```

Expected final lines:

```
 Test Files  11 passed (11)
      Tests  137 passed (137)
```

Covers the mock `ControlPlanePort`, semantic tools with
authorization and redaction rules, and the `CapabilityIssueThreadSnapshot`
view-model contract — including that every one of the twelve deterministic
screenshot states builds a schema-valid snapshot with no credential anywhere in
the projected view.

## 3. Open the issue thread in fake mode (about 2 minutes)

```sh
bun run --filter @clayon/clayon-runner console:issue-thread
```

Open <http://127.0.0.1:4184/#/issue/hb-baseline?shot=thread-baseline>.

A Clayon issue thread, not a dashboard. Header carries
three identity chips visible in every mode — `Fake agent`,
`In-process runner`, `Mock Clayon` — plus the mock issue identifier
(reserved `MCK-` prefix), status, priority, and the Scenario / Replay / Reset /
Stop controls. Main column is one readable work thread; Evidence panel
collapsed on the right.

Swap the `shot` value to seed any of the twelve contract states — each one is a
different item type or interaction state from the
issue-thread UX contract `antl:clayon/packages/clayon-runner/docs/design/capability-issue-thread-ux-contract`:

```text
[12]{shot=,What it shows}:
  `thread-baseline`,"User message, model prose, a durable `Recorded to mock thread` comment, and a collapsed tool strip."
  `turn-streaming`,"A streaming turn with the composer in its `streaming` state (input editable, Stop primary)."
  `interaction-question-pending`,An inline `ask_user_questions` card that refuses an incomplete submit.
  `interaction-confirmation-pending`,A revision-bound confirmation that requires a reject reason.
  `interaction-resolved-mixed`,"Accepted, rejected, expired, and stale interactions as durable history."
  `denial-optional-tool`,A verbatim typed denial with its Evidence badge and no protected data.
  `document-revision`,A document revision card bound to the mock document.
  `deliverable-registered`,A registered deliverable reporting one size in one unit.
  `disposition-terminal`,A terminal disposition that disables the composer.
  `debug-panel-open`,The eight-section Evidence panel opened on the authorization records.
  `reconnect-banner`,"The reconnect banner and its `Reconnected` confirmation."
  `replay-mode`,"The replay progress strip with `Step back`, `Next turn`, and `Play all`."
```

Open the Evidence panel (or the `Evidence` segment on a phone). Eight
sections stay in fixed order: Tools exposed, Calls & results, Authorization,
Control plane, Runner & events, State diff, Traceability, Parity. Tools
section separates `Agent tool — always`, `Agent tool — granted` (with its
grant), and a `Control plane (not exposed to the agent)` list — what the model
*cannot* call is first-class evidence. Every strip, denial, and card deep-links
into its record; each record links back to its thread anchor.

Resize below 768px: page collapses to a `Thread` / `Evidence`
segmented control, keeps Stop outside the `⋯` menu while a turn is active, and
never scrolls horizontally.

## 4. Record the deterministic screenshot matrix (about 1 minute)

Recorded evidence generation is deferred from this release.

First writes 24 images — twelve slugs at 1440×900 and 390×844 — to
`.clayon-local/evidence/capability/ui/`. Every mobile capture asserts no horizontal
scroll before the shot. Second re-records and confirms all 24 reproduce
byte-for-byte — the property that makes the fake-mode matrix a stable
acceptance artifact. Both modes render fixture time only; a fresh checkout
reproduces the committed images exactly.

## 5. Optional: drive a real Codex turn (live mode)

Live mode needs a Rust toolchain and a locally authenticated Codex. Starts a
real `clayon-runnerd` process and a real Codex app-server session;
package server owns the process, the tool loop, and the provider credential;
the browser receives none of them. **Skip this section without Codex
installed** — nothing above depends on it.

Headless smoke over the package server:

```sh
bun run --filter @clayon/clayon-runner smoke:capability:ui
```

Creates a session, runs live turns, asserts identity reads
`Real Codex` / `Real runnerd` / `Mock Clayon`, a real tool call
recorded with its authorization record, the control-plane-owned list
withheld from the agent, no credential in the view.

Capture the live browser frames (a real browser driving a real Codex turn).
Recorded evidence generation is deferred from this release.

Frames land in `.clayon-local/evidence/capability/ui-live/`. Intentionally
**not** byte-stable — a real provider turn varies — so excluded from the
determinism gate; this mode satisfies the final live acceptance
criteria. A scripted (`mode=fake`) frame cannot.

Prove the process and network boundary directly:

```sh
bun run --filter @clayon/clayon-runner trace:live-runner -- --json
```

Checks a real semantic-tool mutation, typed result, same-thread second
turn, process ownership and cleanup (`runnerExited`, `authorityCleared`), and —
critically — `noRealClayonRequest` and `noClayonAuthorityInChild`.

## Reset, stop, replay, and cleanup

These controls work the same in either mode: they act on the mock core
and the runner session, not the agent:

- **Reset** asks first, then restores the original clean mock seed under new
  run/session authority and rotates or clears the old authority. Never
  touches another browser session.
- **Stop** cancels only the active turn and reaps the runnerd process group; the
  session and transcript survive with a `Stopped by user` marker.
- **Replay** reproduces a recorded canonical timeline. Always scripted,
  always labelled fake-derived.
- **Refresh / reconnect** restores the same session, pending interaction,
  transcript, mock state; reconnect starts a fresh runnerd and Codex and
  resumes the persisted thread without restarting the conversation.

## What this does not do

- No ACPX implementation and no real control-plane integration. Real Clayon
  binding is future upload integration and requires separate approval.
- No provider, runner, or control-plane credential in the browser, ever.
- Nothing you type persists beyond the mock session. Reload drops an
  unsent draft — the accepted trade against storing conversation content.

References: issue-thread UI `antl:clayon/packages/clayon-runner/docs/capability-issue-thread-ui`,
live runnerd and Codex loop `antl:clayon/packages/clayon-runner/docs/capability-live-runnerd-codex`,
execution modes and identity `antl:clayon/packages/clayon-runner/docs/capability-execution-modes`.
