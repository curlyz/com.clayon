# com.paperclip docs — router

Two doc trees, both owned here:

- **`docs/`** (this folder) — the published Mintlify docs site. Navigation
  source: [`docs.json`](docs.json); develop with `bun run docs:dev`. Every
  page shipped here must be in the `docs.json` nav.
- **`doc/`** — internal operational and product docs (SPEC, GOAL, runbooks,
  dated plans in `doc/plans/`, internal spec drafts in `doc/specs/`, table
  whitepapers, and `doc/briefs/` — task briefs and explainers that arrived
  from the antl common tree on 2026-10-17: the t224 portal-visuals brief +
  thread, and the `clayon-explained`/`clayon-setup` HTML explainers).
  Start: [`doc/GOAL.md`](../doc/GOAL.md) →
  [`doc/PRODUCT.md`](../doc/PRODUCT.md) → [`doc/SPEC-implementation.md`](../doc/SPEC-implementation.md).

`doc/` folder map (added 2026-10-17; every folder routed):

| folder | owns |
| --- | --- |
| `doc/architecture/` | runner and scheduler architecture notes (clayon-runner compatibility/daytona networking, durable-continuation scheduler, native status arbitration, runner copilot capabilities) |
| `doc/assets/` | images used by the internal docs (avatars, banners, four-pillars plates) |
| `doc/briefs/` | task briefs and explainers (t224 portal-visuals brief + thread; `clayon-explained`/`clayon-setup` HTML, moved from the antl common tree 2026-10-17) |
| `doc/connections/` | per-provider connection records and verification runs (AgentMail, AI-connection routers/aggregators, dated verifications) |
| `doc/database/` | table whitepapers (`tables.md` law: a table without an entry does not get created) |
| `doc/plans/` | dated internal plans `YYYY-MM-DD-slug.md` (incl. the Cloudflare port rung-1 gateway plan) |
| `doc/plugins/` | plugin system docs (authoring guide, plugin spec, distribution, sandbox hooks, local development) |
| `doc/spec/` | older per-surface spec drafts (agent-runs, agents-runtime, invite-flow, ui) |
| `doc/specs/` | internal spec drafts (companies, external-task-protocol, agent-config-ui, cliphub-plan) |
| `doc/testing/` | testing prerequisites (new-agent-prerequisites) |
| root `*.md` | the operational runbook set: GOAL, PRODUCT, SPEC + SPEC-implementation, DEVELOPING, DATABASE, CLI, DEPLOYMENT-MODES, observability, TELEMETRY_WORKFLOW, STORYBOOK-DEPLOYMENT, RELEASE-NOTES, and the rest of the dated records |

## docs/ site map

| group | covers |
| --- | --- |
| `start/` | what Clayon is, quickstart, core concepts, architecture |
| `guides/board-operator/` | running a company from the board UI (guides root also holds loose `execution-policy.md` and `openclaw-docker-setup.md`) |
| `guides/agent-developer/` | how agents work, heartbeat, approvals, cost reporting, skills |
| root concept pages | `agents-runtime`, `built-in-agents`, `feedback-voting`, `pipelines-tutorial` |
| `deploy/` | local dev, Docker, AWS ECS, deployment modes, database, secrets, storage, env vars, Tailscale, restart hygiene |
| `adapters/` | local/process/HTTP agent adapters, creating an adapter |
| `api/` | REST API per area (companies, agents, issues, approvals, routines, costs, secrets, activity, dashboard) |
| `cli/` | `clayon` CLI setup and control-plane commands |
| `assets/` | screenshots referenced by pages |
| `images/` | page images alongside the assets |

## Coverage status (2026-10-17, refreshed by the workspace docs audit)

Documented: board UI guides, deploy, 13 API areas, 10 adapter pages, CLI
setup + core control-plane commands, agent-developer guides.
Known gaps, by area, largest first. New pages land in `docs.json` the
same change.

### API surface

| gap | size | detail |
| :-- | :-- | :-- |
| route areas without an `api/` page | ~68 | pipelines, cases, decisions/queues/models/training, chat-channels, board-chat, email, voice-sessions, browser-use, plugins, tool-gateway, tool-access, public-mcp, ai-connections, connection-intents, environments, execution-workspaces, file-resources, folders, attention, smoke-lab, status-cards, summary-slots, teams-catalog, company-skills, inbox-\*, instance-\*, issue-tree-control, llms, managed/remote-agent-profiles, primary-agent, project-tools, resource-memberships, sidebar-\*, slack-tools, user-profiles, dot-runner, cloud, customer-success, access/invites, announcements, assets, org-chart-svg, … |
| adapters without a page | 9 of 15 | cursor local/cloud, grok, opencode, pi, hermes, hermes-gateway, openclaw-gateway, `clayon_runner` — all 15 rows, `grok_local` included, are listed in `adapters/overview.md` |
| CLI long tail | server + client verbs | server: pipelines, routines, worktree, service, mcp, test-drive, managed-agent, db-backup, env-lab, channels, git-workspace, heartbeat-run, onboard-service, runtime; client: connect, connections, plugin, teams, zip, email, asset, token, prompt, feedback, context |
| Cloudflare gateway port | rung 1, not deployed | `gateway/` + `packages/openapi/`; internal plan `doc/plans/2026-10-16-cloudflare-port-rung-1-gateway.md` |

### Product surfaces with no published page

| surface | what exists |
| :-- | :-- |
| plugin ecosystem | sdk, create-clayon-plugin, sandbox-providers, plugin-llm-wiki, plugin-workspace-diff, plugin-cngkit-code-stream, fake-sandbox, all examples, `integrations/assistant-plugins` |
| Capacitor mobile shell | `ui/capacitor.config.ts`, `ui/ios/`, appId `com.clayon.mobile` |
| Storybook | `ui/storybook/`, CI-deployed — internal doc `doc/STORYBOOK-DEPLOYMENT.md` only |
| Telemetry pipeline | first-party, opt-out; needs a published privacy/opt-out page; internal doc `doc/TELEMETRY_WORKFLOW.md` |
| UI surfaces (~20) | Inbox/WhatNeedsMe, Search, Timeline, BoardChat, AgentChats, SkillStudio, SkillSources, McpConnect, Cases, DecisionQueuePage, Pipelines, CompanyEnvironments, InstanceAccess/CompanyAccess, CliAuth, JoinRequestQueue, PortalHome, Workspaces, PluginManager/PluginSettings, smoke-lab, `/design-guide` |

### Built-but-unmentioned trees

| tree | note |
| :-- | :-- |
| `packages/mcp-server`, `packages/kv-demo-mcp-server`, `packages/tailscale-https-broker`, `packages/clayon-eval-kernel` + `evals/`, `packages/teams-catalog`, `packages/clayon-runner`, `tools/agent-shim` | no page mentions them |
| `packages/google-sheets-mcp-server` | deletion candidate in the rung-1 plan |
| `skills-releases/`, `announcements/`, `docker/` variants | ops surfaces, unmentioned |
| `tests/` (15 entries — e2e, runner-e2e, release-smoke, perf, canary-onboarding, runner-acceptance, runner-recovery, storybook-visual, fixtures, …; no `unit/` folder), `ui/tests/` | unmentioned |
| `scripts/` | incl. `check-token-gates.mjs` behind `bun run check:token-gates` |
| `patches/` | bun `patchedDependencies` sources — removing one breaks `bun install` |
| `skills/` | runtime and operational skills, distinct from the app skills catalog |

Naming note (2026-10-17): the rename back to Paperclip is half-done — the
repo dir, gateway and contract already say Paperclip, while the published
site (`docs.json` name, `what-is-clayon.md`, every page id) and the CLI
package name still say Clayon. Also: the `npx clayon` instructions in
quickstart/setup pages point at an npm package that is **not published**
(verified 404 on npm, 2026-10-17); the working in-repo form is
`bun run clayon …`. Both need an operator naming/publishing decision
before the pages are rewritten.

## Deviation record

The antl standard docs shape (`convention/`, `superpowers/`, `memories/`,
`actions/`, ledger) is not used here: Clayon keeps its upstream
Mintlify site + internal `doc/` split, recorded in `AGENTS.md` § structure
deviation (operator, 2026-10-13). Workspace law lives at the antl root
(`~/usr/antl/com.agents/docs/convention/`).
