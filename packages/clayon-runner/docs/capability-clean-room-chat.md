---
id: antl:clayon/packages/clayon-runner/docs/capability-clean-room-chat
---

# Capability clean-room live chat

Capability adds a second primary path beside the preset scenario explorer. A board user opens a blank chat, sends a free-form message, and watches real Codex work a mock Clayon issue through real runnerd. No scenario to pick, no recorded transcript, no scripted tool tour.

Both paths ship in the same app and share one view contract. The difference: what the session is seeded with, and whether a fixture may stand in for a provider.

```text
[5]{Aspect,Preset scenario explorer,Clean-room chat}:
  Route,`#/issue/<fixtureProfile>`,`#/chat`
  Seed,"A recorded eval case: transcript, scripted calls, parity verdicts","A company, an agent, and one blank issue"
  Modes,"`fake` (default), `replay`, `mode=live`",Live only — no fixture, no recording
  Tool calls,Fixed by the scenario,Chosen by the conversation
  Evidence drawer,Collapsed by default,Collapsed by default
```

## What "clean room" means

Every open mints a new mock tenant — new company, actor, task, `MCK-` identifier — and seeds nothing else. `assertCapabilityCleanRoomSeedIsBlank` fails the open if any comment, document, interaction, approval, artifact, blocker, wake, or fault is present. "The thread starts blank" is enforced at the session-creating seam, not assumed.

The only mutation an open performs is the run checking the mock issue out — why a fresh room reads `in_progress`, not `todo`.

## Live only, and loudly so

The clean room never falls back:

- `parseCapabilityRoute` pins `mode` to `live` on `#/chat` and drops `shot` and `at`. No URL can make it render a fixture or recording.
- The package server has no scripted path for this route. It projects the live session and refuses any view that is not `mode=live` with a `Real Codex` agent label.
- When runnerd or the Codex app-server cannot start, the surface says exactly that and offers `Try again`. It never renders a canned thread.

## Exposure profile

The profile is deterministic and inspectable even though the calls are not. `CAPABILITY_CLEAN_ROOM_CLAIMS` grants the read, comment, document, interaction, deliverable, delegation, dependency, wake, and approval-request operations.

Three grants stay withheld on purpose:

- **`governance:approvals:decide`** — The agent may request an approval; the board decides it.
- **`workspace:control`** — No service lifecycle changes from a chat.
- **`test:generic_api_request`** — The escape hatch stays off.

Withholding them keeps a denial reachable in an unscripted conversation: if the model reaches for one, it gets a typed denial with a named code and the mock state does not move. The Evidence drawer's Tools section lists all three under `Control plane (not exposed to the agent)`.

The run itself holds the wider adapter claim set the mock command boundary requires (`capabilityFixtureRunCapabilities`). That union widens the port, never the catalog the model sees: effective claims are the intersection of run claims, scenario claims, and explicitly delegated claims.

## Session lifecycle

```text
GET  /api/capability/ui/cleanroom/session[?sessionId=…]   open or reconnect
POST /api/capability/ui/cleanroom/session {sessionId?}    New chat (retires the caller's room)
POST /api/capability/ui/message      {sessionId, message}
POST /api/capability/ui/interrupt    {sessionId}
POST /api/capability/ui/reconnect    {sessionId}
POST /api/capability/ui/reset        {sessionId}
POST /api/capability/ui/interaction  {sessionId, interactionId, outcome, result}
```

`Reset` and `New chat` both stop active work, clear the previous session's authority, drop its workspace directory, and open a new tenant. A retired session id answers `404` on every route afterwards — rotation is verifiable, not just visible. Refresh reconnects to the same durable session; a stale id from `localStorage` opens a fresh room rather than dead-ending.

The clean room stores its session id under its own `localStorage` key, so a scenario session can never be handed to the chat route or the reverse.

## Bounds

- **Turns per chat** — 24, then a named `turn_limit` refusal that points at `New chat`
- **Message size** — 8 KiB
- **Concurrent clean rooms** — 4; the oldest yields to a new board user
- **Turn timeout** — 120 s (`CapabilityLiveSessionService` default)

## Real-API block

`CapabilityLiveSession` routes every Clayon operation through the in-process mock `ControlPlanePort`; no code path reaches a Clayon URL. The projection makes it a record, not a claim: the Control plane section of the Evidence drawer carries a `network-guard-<sessionId>` row reading `Real Clayon API requests: 0. Child CLAYON_* environment keys: none.`

The child environment is allowlisted by `createSanitizedCodexEnvironment`, so no `CLAYON_*` value reaches runnerd or Codex, and the browser receives no provider, runner, or control-plane credential.

## DevTools state inspector

Opening **DevTools** opens a Redux-DevTools-style inspector over the live mock company. Its timeline starts at the pristine fixture, adds a revision per successful semantic mutation, and lets the operator inspect or diff the complete browser-safe company scaffolding: company, actors, tasks, comments, documents, interactions, approvals, artifacts, work products, blockers, workspace services, budgets, runs, wakes, audit records, decisions, idempotency records, and configured faults. Separate tabs expose the protocol boundary records, runner/runtime facts, and effective authority. A dedicated **Documents** tab renders every mock document and switches between retained revisions without raw JSON.

The Evidence log consolidates repeated tool-exposure snapshots into one deduplicated catalog. Its Always, Granted, and Control-plane groups fold independently; selecting a tool opens its catalog title, description, placement, required claims, allowed task modes and roles, and full input schema.

**Pause** pins a revision while work continues, **Export** downloads the redacted DevTools snapshot, and **Fork rN** retires the current mock session and starts a new executable branch from that retained state. Provider payloads, session checkpoints, artifact content references, working directories, and secret-shaped strings stay server-side or are withheld by the explicit browser projection.

While a turn runs, a live status rail appears immediately after send and tracks the newest safe Codex activity. Reasoning, planning, shell-command, file-change, MCP/dynamic-tool, assistant-stream, and Clayon semantic-tool lifecycle events each trigger an interim frame. Discrete tools stay separate rows; only noisy text deltas are grouped. Structured shell items show a bounded, credential-redacted command preview; raw command output, other provider payloads, and chain of thought stay withheld.

## Remote preview gateway

The tailnet preview keeps the package server on loopback and exposes it through `dist/capability/tailnet-gateway.js`. Every API call requires the gateway's high-entropy HttpOnly capability cookie. Mutations additionally require the exact configured `Origin` and `application/json`.

Fetch Metadata is defense in depth: any supplied `Sec-Fetch-Site`, `Sec-Fetch-Mode`, or `Sec-Fetch-Dest` value must describe the expected same-origin `fetch()` request. Browsers omitting one or all of those optional headers are still accepted after the capability, Origin, and content-type checks pass. Safari and embedded/private browser clients keep working; the explicit cross-site denial stays.

## Verification

```text
[5]{Surface,Command}:
  "Seed, exposure profile, and identity rotation",`bun run --filter @clayon/clayon-runner test:scenarios`
  Clean-room HTTP routes end to end (stub provider),included in `test:scenarios`
  "Browser entry, blank state, evidence-on-demand, narrow layout, axe",`bun run --filter @clayon/clayon-runner test:browser:issue-thread`
  Real Codex through real runnerd,`bun run --filter @clayon/clayon-runner smoke:capability:cleanroom`
  Live screenshots,`bun run --filter @clayon/clayon-runner recorded-evidence campaign (deferred)`
```

See the clean-room chat tutorial `antl:clayon/packages/clayon-runner/docs/tutorials/capability-clean-room-chat` for the clean-start walkthrough, execution modes and identity `antl:clayon/packages/clayon-runner/docs/capability-execution-modes` for the fake/live eligibility rules, and the issue-thread UI reference `antl:clayon/packages/clayon-runner/docs/capability-issue-thread-ui` for the thread, composer, and Evidence panel this surface reuses.
