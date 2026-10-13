---
id: antl:clayon/packages/clayon-runner/docs/capability-mock-control-plane-port
---

# Capability Mock ControlPlanePort

`CapabilityMockControlPlaneAdapter` is a deterministic, serializable, in-memory model of Clayon's control-plane **semantics** — not its transport. It imports no server route, service, database, or provider binding, and holds no credential.

Sources: `src/mock-core/capability-mock-control-plane-adapter.ts`,
`src/mock-core/capability-control-plane-types.ts`. Shared contract:
`src/conformance/control-plane-port.ts`.

## Entity domains

The adapter models ten renderable entity domains, exactly the domains the scenario explorer `antl:clayon/packages/clayon-runner/docs/capability-scenario-explorer` diffs:

`tasks`, `comments`, `documents`, `interactions`, `approvals`, `artifacts` (artifacts and work products), `blockers`, `workspace` (workspace services), `budget`, and `run`.

The fixture state also carries supporting records — company, actors, wakes, audit, decisions, idempotency, faults, counters, and a fixture clock — that back behavior but are not diff domains.

## Operations

- **Lifecycle:** `start()` / `stop()` only change local object state.
- **Runs:** `openRun()` / `openFixtureRun()` return a run context with atomic
  checkout; `context(runId)` reads it back.
- **Events:** `appendEvent()` accepts both canonical PRP events and native run
  events with deduplication, replay-conflict detection, and contiguous-sequence
  tracking; `replayEvents()` replays from an exclusive cursor.
- **Commands:** `applyCommand(envelope)` executes a semantic command with
  idempotency and an optimistic `expectedRevision`.
- **Sessions:** `loadSessionCheckpoint()` / `checkpointSession()`.
- **Terminal:** `completeRun()` reconciles a terminal disposition — `done`,
  `blocked`, `needs_review`, or `yielded` — and fans out blocker wakes.
- **Introspection:** `snapshot()`, `decisionRecords()`, `serialize()`, and
  static `restore()`.

The eighteen semantic command kinds (`report_progress`, `write_document`, `request_human_input`, `resolve_human_input`, `register_deliverable`, `set_dependencies`, `create_task`, `request_approval`, `decide_approval`, `comment_on_approval`, `control_workspace_service`, `record_budget_usage`, `finish_task`, `block_task`, `request_review`, `release_task`, `schedule_wake`) are the mock side of the semantic tool catalog `antl:clayon/packages/clayon-runner/docs/capability-semantic-tools`.

## Determinism

- **Fixture clock.** Every timestamp derives from `clock.epochMs + tick*1000`; the tick increments on each read. Default epoch: `2026-08-09T00:00:00Z`. No RNG anywhere.
- **Deterministic IDs.** Every generated ID is `fixture-<kind>-<nnnn>` from a monotonic per-kind counter.
- **Immutability.** Inputs and outputs are `structuredClone`d and every returned value is deep-frozen. Canonical JSON with sorted keys backs every dedupe and replay comparison.
- **Serializable.** `serialize()` / `restore()` round-trip under the schema tag `clayon.capability.mock-state.v1`.
- **Scripted faults.** A fault rule injects a bounded number of `retryable_error` or `lost_ack` effects; a lost-ack command commits once and returns its stored result on retry.

## Boundary

The adapter is a pure state machine: no network, no database, no provider SDK, no credentials. Secrets appearing in wake payloads are redacted against `/authorization|credential|api.?key|secret|token/i`; the adapter test seeds `apiKey` and `Bearer` values and asserts they never surface. See
authorization and exposure `antl:clayon/packages/clayon-runner/docs/capability-authorization-and-exposure`.

## Shared conformance

The adapter satisfies the same `runControlPlanePortConformance` contract used by earlier phases: it rejects open-binding violations, recovers from source gaps, treats duplicates idempotently, and rejects event-id, sequence, replay-binding, and result mutations (failing closed with `native_event_replay_conflict`).

## Running the tests

```sh
pnpm --filter @clayon/clayon-runner exec vitest run \
  src/conformance/control-plane-port.test.ts \
  src/mock-core/capability-mock-control-plane-adapter.test.ts
```

Nine tests, no npm alias of their own — they also run inside
`pnpm --filter @clayon/clayon-runner test`.

## Related

- Semantic tool catalog `antl:clayon/packages/clayon-runner/docs/capability-semantic-tools`
- Authorization and exposure `antl:clayon/packages/clayon-runner/docs/capability-authorization-and-exposure`
- Future binding boundary `antl:clayon/packages/clayon-runner/docs/capability-future-binding-boundary`
