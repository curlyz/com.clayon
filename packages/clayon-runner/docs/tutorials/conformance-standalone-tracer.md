---
id: antl:clayon/packages/clayon-runner/docs/tutorials/conformance-standalone-tracer
---

# Conformance: Run the Standalone Tracer

## What this phase is

Smallest standalone runner path. Mock control plane; never starts Clayon.

## What this phase proves

Package has an independent Rust boundary. Rust and TypeScript accept the same fixture.

You install the package tools, compile Rust and TypeScript, run tests and checks.

You start the Rust mock core. Tracer validates one fixture, prints a deterministic result, then the process stops.

## Prerequisites

- repository checkout on the assigned runner branch;
- Node.js 20 or newer;
- Bun 1.4 or newer;
- stable Rust with `cargo` on `PATH`;
- commands run from the repository root.

## 1. Install the package tools

```sh
bun install --filter @clayon/clayon-runner --no-save --ignore-scripts --dev
```

`--no-save` keeps the install out of the manifest and the root lockfile,
which automation owns. `--ignore-scripts` proves Conformance needs no
postinstall hook from the newly linked package. `--dev` makes package
tooling explicit even when the calling shell has
`NODE_ENV=production`.

## 2. Build the standalone package

```sh
bun run --filter @clayon/clayon-runner build
```

Expected: TypeScript writes package-local `dist/` files; Cargo builds
the `clayon-runner-core` crate under `runner/target/`.

## 3. Run the behavior and boundary tests

```sh
bun run --filter @clayon/clayon-runner test
bun run --filter @clayon/clayon-runner check:forbidden-imports
```

Tests cover fixture validation, complete Rust and TypeScript mock-core paths,
stable output, negative TypeScript/Cargo core-dependency fixtures. Standalone
boundary check must print `Standalone boundary check passed.`

## 4. Validate the documentation

```sh
bun run --filter @clayon/clayon-runner docs:validate
```

Expected: documentation-link validation passes. Historical OKF and
recorded-evidence bundle intentionally deferred from this release.

## 5. Run the tracer

```sh
bun run --filter @clayon/clayon-runner trace:conformance
```

Expected final line:

```json
{"schemaVersion":"clayon.runner.conformance.output.v1","runIdentity":{"runId":"run_conformance_0001","sessionId":"session_conformance_0001"},"result":{"status":"succeeded","summary":"Standalone Conformance fixture accepted."}}
```

Command exits successfully after the mock core stops. No service remains

Default tracer is Rust. Prove the TypeScript reference produces the
same bytes:

```sh
bun run --filter @clayon/clayon-runner check:conformance-parity
```

Expected: `Rust and TypeScript Conformance tracer output matches the shared
golden fixture.`

## 6. Inspect the conformance fixture

```sh
sed -n '1,240p' packages/clayon-runner/protocol/fixtures/conformance-minimal-run.json
```

## One-command rerun

After installation, repeat the same checks with:

```sh
bun run --filter @clayon/clayon-runner verify
```

Continue with the cumulative end-to-end tutorial `antl:clayon/packages/clayon-runner/docs/tutorials/end-to-end`, which points
to this tutorial as the current complete path.
