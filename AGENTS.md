---
id: antl:clayon/agents
---

# AGENTS.md

Guidance for human and AI contributors in this repository.

## 1. Purpose

Clayon is a control plane for AI-agent companies.
Implementation target: V1, defined in `doc/SPEC-implementation.md`.

**Production runs on the antl VPS (2026-10-10):** Dokploy stack `clayon`
(project `server`, composeId `CSdiym07Up7Q1AjvEop7j`) on `contabo-eu-vps6`,
live at https://clayon.app, own Postgres 17 service.
Runbook, compose file, bootstrap gotchas:
`servers/contabo-eu-vps6/README.md` § Clayon.
Deploy through Dokploy (panel or authenticated API) — never SSH into the host.

## 2. Read This First

Read before changes, in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md`: long-horizon product context.
`doc/SPEC-implementation.md`: concrete V1 build contract.

When adding or changing an Apps catalog connection, follow
`doc/connections/CONNECTOR-PLAYBOOK.md` — canonical authoring runbook for
provider research, supported transport/auth patterns, credential handling,
branding, implementation, testing, live proof, and PR submission.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations (Claude, Codex, Cursor, etc.)
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `packages/skills-catalog/`: app-shipped skills catalog (`@clayon/skills-catalog`)
- `packages/teams-catalog/`: app-shipped teams catalog (`@clayon/teams-catalog`)
- `cli/`: `clayon` CLI package (published bin, agent-facing commands)
- `skills/`: Clayon runtime/operational skills (not part of the app catalog)
- `doc/`: operational and product docs (`doc/logs/` holds dated implementation reports)
- `docs/`: the published Mintlify docs site (`docs.json`)
- `tests/`: unit, e2e and runner-e2e suites
- `evals/`: agent-behaviour eval framework
- `feature-map/`: user-capability recipes for reproducing and verifying bugs
- `integrations/`: assistant plugin bundles (Claude, Codex)
- `docker/`: agent-runtime and onboarding images
- `skills-releases/`: published Clayon skill releases
- `tools/`: standalone helper binaries (`agent-shim`)
- `design/` · `announcements/`: one-off design pages and announcement examples
- `patches/`: pnpm `patchedDependencies` sources (see the deviation below)

**Structure deviation from the antl brand shape (operator, 2026-10-13: "pls
clayon app stay with its express app. no convex"):** Clayon is its own
Express and pnpm product, not an `apps/` + `packages/` brand. It keeps its
upstream tree, its test suites and its `patches/` folder, which
`pnpm-workspace.yaml` `patchedDependencies` reads; the antl bans on tests and
`patches/` apply to the brand workspaces only. Removing a patch breaks
`pnpm install`.

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

### Dev UI against the production backend (operator, 2026-10-11)

"Dev clayon" is the working-tree UI served by Vite on **http://localhost:2009**,
`/api` proxied to production `https://clayon.app`.
No local server, database or native runner build runs.

```sh
pnpm --dir ui dev:remote   # from com.clayon; strict port 2009
```

- Proxy: `ui/src/lib/vite-api-proxy.ts` (`createRemoteApiProxy`), chosen in `ui/vite.config.ts` when `CLAYON_DEV_API_TARGET` is set. Sends the production origin upstream (the server's origin guard expects it) and strips the cookie `Domain` so the session sticks to localhost.
- Sign in through the dev UI at `localhost:2009`; Chrome accepts the `Secure` session cookie on localhost.
- **Writes hit production data.** Autosave saves within a second; edits in the dev UI change the real company.
- Port 2009 (operator, 2026-10-11: "setup the dev frontend port to be 2009"); 10000 earlier the same day.
- Google sign-in needs `http://localhost:2009/api/auth/callback/google` as an authorized redirect URI on the Google OAuth client, or the callback is rejected.

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Scope every domain entity to a company; enforce company boundaries in routes/services.

Exception: announcement dismissals are instance-wide user preferences,
keyed by user and announcement, persisting across companies. Audit
context still validates company membership. The announcement publication-ID
registry is instance-level feed metadata, no company or user data.

2. Keep contracts synchronized.
Change schema/API behavior → update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates; keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep repo plan docs dated and centralized.
New repo plan documents belong in `doc/plans/`, named `YYYY-MM-DD-slug.md`. This does not replace Clayon issue planning: if a Clayon issue asks for a plan, update the issue `plan` document per the `clayon` skill, not a repo markdown file.

6. Attach inspectable generated artifacts.
For a user-inspectable deliverable file, follow the Clayon skill's "Generated Artifacts and Work Products" workflow before final disposition. In this repo, prefer the self-contained skill helper `skills/clayon/scripts/clayon-upload-artifact.sh` so the file is available through the Clayon API; create/update an artifact work product when the file is the deliverable; link the uploaded artifact in the final issue comment, then set status. Never rely on local filesystem paths as the only access path. If an important file intentionally remains workspace-only, create/update a work product with `metadata.resourceRef.kind: "workspace_file"` and a workspace-relative path, then name that work product and path in the final comment. Treat browse/search as a fallback for recovering workspace files, not the preferred deliverable path. See `doc/AGENT-ARTIFACTS.md` for details and `.mp4`/`.webm` examples.

7. Name the three data paths correctly.
Match a change to a path by file path, not by the word "observability" or "telemetry" alone.

- **Telemetry** is the Clayon first-party event system. Opt-out; sends data to a Clayon endpoint by default. Paths:
  - `packages/shared/src/telemetry/`
  - the generated contract `packages/shared/src/telemetry/generated/clayon-telemetry.ts`
  - each caller of `packages/shared/src/telemetry/events.ts` or `packages/shared/src/telemetry/client.ts`
- **Observability** is the OpenTelemetry trace path. An operator must set an OTLP endpoint; until then the tracer is a no-operation. Paths:
  - `server/src/instrumentation.ts`
  - `doc/observability.md`
  - `packages/adapter-utils/src/duplex-observability.ts`
  - `server/src/services/duplex-observability-recorder.ts`
  - `server/src/services/issue-read-timing.ts`
  - the span attributes in `packages/adapter-utils/src/acpx-engine/startup-timing.ts`
- **The run log** holds rows in the local `heartbeat_run_events` table; data stays in the instance database. Paths:
  - `doc/run-log-events.md`
  - `packages/db/src/schema/heartbeat_run_events.ts`
  - the append path `appendRunEvent` in `server/src/services/heartbeat.ts`

Apply a review level that matches the path:

- **Telemetry change (strict review).** Author updates the generated contract first, updates `packages/shared/src/telemetry/README.md` in the same pull request, and requests a privacy review. Reason: a Telemetry event goes to a Clayon endpoint by default, so a mistake sends data immediately.
- **Observability change (lighter review).** Operator endpoint gate stays in place; no-operation behaviour stays when no endpoint is set. No privacy review while the change stays inside the closed span-attribute allowlist.
- **Run-log change (no extra review).** Data stays in the instance database; neither review level above applies.

**Exclusion.** "observability" in a file such as `server/src/services/recovery-observability.ts` names a different concept. Apply this rule by path, not word match.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

`feature-map/README.md`: optional reference for user
entry points, verification recipes, coverage gaps. Records coverage
scope, not proof a live journey passed.

Default local/agent test path:

```sh
pnpm test
```

Cheap default; runs the Vitest suite only. Browser suites stay opt-in:

```sh
pnpm test:e2e
pnpm test:release-smoke
```

Run browser suites only when your change touches them or you explicitly verify CI/release flows.

For normal issue work, run the smallest relevant verification first. Do not default to repo-wide typecheck/build/test on every heartbeat when a narrower check proves the change.

Run this full check before a PR-ready hand-off, or when the change scope is too broad for targeted checks:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors
- Form and wizard footers: keep Save & exit (or Cancel/Back) left and the primary action right in the same vertically aligned row. Each step owns the entire footer; never append Save & exit as a separate row. See `DESIGN.md`.

## 10. Pull Request Requirements

When creating a pull request (via `gh pr create` or any other method), **must** read and fill in every section of `.github/PULL_REQUEST_TEMPLATE.md`. No ad-hoc PR bodies — the template structures your PR description. Required sections:

- **Thinking Path** — trace reasoning from project context to this change (see `CONTRIBUTING.md` for examples)
- **What Changed** — bullet list of concrete changes
- **Verification** — how a reviewer can confirm it works
- **Risks** — what could go wrong
- **Model Used** — the AI model that produced or assisted with the change (provider, exact model ID, context window, capabilities). Write "None — human-authored" if no AI was used.
- **Checklist** — all items checked

## 11. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
5. PR description follows the PR template `com.clayon/.github/PULL_REQUEST_TEMPLATE.md` with all sections filled in (including Model Used)

## Design system

`DESIGN.md` at repo root is the source of truth for UI design decisions. Token-only rule for all `ui/` changes: every color, spacing, radius, type, shadow, and motion value in `ui/src/components/**` and `ui/src/pages/**` comes from the token layer in `ui/src/index.css` — no hex, raw px, arbitrary Tailwind bracket values, or raw `font-size`/`fontSize` in components, outside the documented allowlist in `ui/src/index.css`. Run `pnpm check:token-gates` (`scripts/check-token-gates.mjs`) before committing UI changes — fails on any violation not covered by that allowlist.

The portal carries no decorative scene (removed 2026-10-11, leader ruling): the emblem remains only as the logo, luminance-masked for transparency on both themes; the surface is flat and theme-aware (light and dark tokens). No further decorative elements.
