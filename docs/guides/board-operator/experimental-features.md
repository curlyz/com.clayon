---
id: antl:clayon/docs/guides/board-operator/experimental-features
title: Experimental Features
summary: What Clayon experimental features mean for board operators
---

Experimental features are opt-in with no compatibility guarantees. They may break, change, or be removed at any time. Use at your own risk.

## What "experimental" means

A feature marked experimental: Clayon is still evaluating product shape and implementation details.

- Not part of the stable operator contract yet.
- UI, API, CLI, behavior, and stored configuration may change as the feature evolves.
- Clayon promises no compatibility, rollback, migration, or long-term support for experimental features.

Stable behavior required for an important workflow: never rely on an experimental feature.

## Where you enable them

Board operators enable or disable experiments from **Instance Settings > Experimental** in the app.
Controls list alphabetically within each section. Hosting operators can hide
controls they manage; empty developer and legacy sections are omitted. Hidden
controls keep their configured values.

The CLI exposes the same surface:

```sh
pnpm clayon instance settings:experimental
npx clayon instance settings:experimental:update --payload-json '{...}'
```

Those commands change the same opt-in settings the UI manages.

## Chat connectors

**Chat connectors** is off by default. Enable it to connect a dedicated
Slack, GitHub, Microsoft Teams, Telegram, or Discord bot to one Clayon
agent. The experiment shows chat setup, connection management, agent channels,
and external task controls.

Off: existing production tool connectors remain available. GitHub, for
example, opens its normal tool connection flow without asking you to
choose between chat and tools.

Visibility control only. Turning it off never disconnects an
existing bot or stops its messages. To stop a connection, pause it from its
chat connection settings before turning off the experiment.

## When to use them

Experimental features fit when you are:

- evaluating a new capability before wider rollout
- testing a non-critical workflow
- comfortable with behavior changes between releases
- prepared to stop using the feature if it changes or disappears

## Operator expectations

Before enabling an experimental feature:

- decide whether the workflow tolerates breakage or churn
- never make the feature a dependency for stable production processes
- keep the scope small until you understand how the feature behaves in your company
- watch release notes and docs for changes to the feature contract

## Related references

- See Status Cards `antl:clayon/docs/guides/board-operator/status-cards` for the watched-query summary experiment, refresh policies, and cost model.
- See the CLI caveat in Control-Plane Commands `antl:clayon/docs/cli/control-plane-commands`.
- See the repo CLI reference in [`doc/CLI.md`](https://github.com/clayon/clayon/blob/master/doc/CLI.md) when working from the repository.
