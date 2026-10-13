---
id: antl:clayon/packages/clayon-runner/docs/tutorials/replay
---

# Replay: Validate and Replay a PRP Fixture

## What this phase is

Static replay path for one Clayon Runner Protocol fixture. Same reducer in CLI and browser.

## What this phase proves

Rust and TypeScript accept the same protocol data. Duplicate events do not change the result.

Tutorial validates one fixture, reduces the events in the CLI, shows the same snapshot in the browser.

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- stable Rust toolchain with `cargo`
- Chromium-compatible browser

Clean repository checkout; run every command from the
repository root. Install only this workspace without writing
the root lockfile:

```sh
pnpm install --filter @clayon/clayon-runner --lockfile=false --ignore-scripts --dev
pnpm --filter @clayon/clayon-runner exec playwright install chromium
```

On a minimal Linux host, Playwright may also request system browser libraries:

```sh
pnpm --filter @clayon/clayon-runner exec playwright install-deps chromium
```

## 1. Check the contract and golden corpus

```sh
pnpm --filter @clayon/clayon-runner typecheck
pnpm --filter @clayon/clayon-runner check:replay-goldens
pnpm --filter @clayon/clayon-runner check:replay-parity
pnpm --filter @clayon/clayon-runner check:forbidden-imports
```

Expected: generated schema sources current, TypeScript and Rust accept the
same fixtures, all parity summaries match, standalone boundary passes.

## 2. Replay the happy path in the CLI

```sh
pnpm --filter @clayon/clayon-runner replay:fixture
```

Expected JSON facts:

- `ok` is `true`;
- `snapshot.integrity` is `complete`;
- `snapshot.timeline` contains 9 entries;
- `snapshot.terminal.runTerminalState` is `succeeded`.

Different fixture path inspects another case:

```sh
pnpm --filter @clayon/clayon-runner replay:fixture packages/clayon-runner/protocol/fixtures/replay/source-gap.json
```

Expected: `snapshot.integrity` is `gap_detected` and the missing source sequence
is `3`.

Unsupported required version exits non-zero, returns structured error:

```sh
pnpm --filter @clayon/clayon-runner replay:fixture packages/clayon-runner/protocol/fixtures/replay/unsupported-required-version.json
```

## 3. Open the standalone replay page

Start the package-local Vite server:

```sh
pnpm --filter @clayon/clayon-runner browser:dev --host 127.0.0.1 --port 4179
```

Open `http://127.0.0.1:4179`, then:

1. Select `Happy path` and confirm the terminal badge reads `succeeded`.
2. Edit the fixture summary in the JSON textarea and select **Validate & replay**.
3. Select `Duplicate event` and confirm one duplicate is ignored.
4. Select `Source sequence gap` and confirm the missing sequence diagnostic.
5. Select `Unsupported required version` and confirm replay is rejected.
6. Expand **Inspect snapshot JSON** and compare it with the CLI output.

Stop Vite with `Ctrl+C`.

## 4. Run the browser regression path

```sh
pnpm --filter @clayon/clayon-runner check:browser-tokens
pnpm --filter @clayon/clayon-runner test:browser
```

Expected: Playwright tests pass; temporary screenshots written under
the ignored `packages/clayon-runner/test-results/` directory. Regression
suite never rewrites committed evidence images.

## What this proves

- JSON Schema is the executable source for validation and TypeScript types.
- CLI and browser call the same validator and reducer.
- Duplicate delivery idempotent; sequence gaps stay visible.
- Unknown optional fields never change the v1 projection.
- No Clayon server, UI, CLI, adapter, or production database module starts or
  imports into the standalone path.

Local runner sits outside this tutorial and must not start before the Replay human
checkpoint.
