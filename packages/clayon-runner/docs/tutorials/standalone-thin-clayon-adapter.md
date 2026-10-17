---
id: antl:clayon/packages/clayon-runner/docs/tutorials/standalone-thin-clayon-adapter
---

# Standalone Adapter Demo

Exercises the Standalone tracer entirely inside
`packages/clayon-runner/`. No runner install into Clayon,
no Clayon API call, no instance flag change, no agent profile edit, no
Clayon task, no repository server/database integration.

## 1. Run the default legacy path

From the repository root:

```sh
bun run --filter @clayon/clayon-runner trace:standalone
```

JSON trace must report:

- `resolvedMode: "legacy"`;
- `resolutionReason: "feature_flag_disabled"`;
- `nativeAdapterInvocationCount: 0`;
- `legacyAdapterInvocationCount: 1`;
- complete replay, reducer, and finalization summaries.

## 2. Enable the native standalone path

```sh
bun run --filter @clayon/clayon-runner trace:standalone -- --feature-flag enabled
```

Trace must report `resolvedMode: "native"`. Both paths execute the same
public `ControlPlanePort` conformance suite and reduce the same canonical PRP
events. Adapter label and invocation counters make the selected path
inspectable.

## 3. Prove the kill switch

```sh
bun run --filter @clayon/clayon-runner trace:standalone -- --feature-flag enabled --kill-switch enabled
```

Trace must return to `resolvedMode: "legacy"` with
`resolutionReason: "kill_switch_enabled"`. No native adapter invocation
allowed after the kill switch resolves the path.

## 4. Open the standalone demo page

```sh
bun run --filter @clayon/clayon-runner demo:standalone
```

Open `http://127.0.0.1:4182/standalone-demo/`. Page starts on legacy.
Toggle the native demo flag, inspect contract/reducer/finalization state,
then enable the kill switch and confirm the page returns to legacy. Expand
trace JSON for replay and idempotency details.

## 5. Run the package-local checks

```sh
bun x vitest run \
  src/standalone/standalone-demo.test.ts \
  src/conformance/control-plane-port.test.ts
bun run --filter @clayon/clayon-runner build:standalone
```

Checks need no running Clayon service or credentials.

## Human checkpoint

1. Confirm the page defaults to legacy.
2. Enable the native demo flag and compare the contract and reducer panels.
3. Inspect the replay and finalization fields in the JSON trace.
4. Enable the kill switch and confirm native invocations return to zero.
5. Confirm no Clayon instance or repository path outside
   `packages/clayon-runner/` was needed.
