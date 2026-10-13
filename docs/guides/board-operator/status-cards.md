---
id: antl:clayon/docs/guides/board-operator/status-cards
title: Status Cards
summary: Experimental watched-query summaries, refresh policies, costs, and agent authoring
---

Status cards are an experimental company-wide board of persistent summaries. Each card starts from one message such as “blocked launch work updated this week — tell me the next decision.” The card's agent (built-in Summarizer by default, or a per-card override chosen at creation or in settings) compiles that prose into bounded company-search queries, stores the effective query set, and follows the same message as instructions for every summary it writes. No separate summarization prompt to append to or replace.

Enable **Status Cards** from **Instance Settings > Experimental**. `enableStatusCards` off: UI routes and REST API return not found; the feature never leaks into non-enabled instances.

## How updates work

SQL change detection runs before any model tokens are spent. Clayon reruns the stored query set on scheduler ticks, compares the result with the previous fingerprint, and marks meaningful additions, removals, or configured field changes as pending.

- **Manual** is the default. Changes make the card stale, but Clayon never starts an automatic update.
- **Interval** checks every 5, 15, 30, or 60 minutes and only starts an update when the watched result changed.
- **Reactive** waits for the debounce window, then updates after significant changes. The v1 defaults are a 60-second debounce and at most 6 updates per hour.
- **Active hours** batch changes outside the configured window into a later update.
- **Daily token caps** pause automatic work when the card reaches its budget. Manual refresh remains available.

Incremental updates receive the previous summary and only the changed tasks. Clayon uses a full rebuild after prompt or agent changes, large deltas, periodic drift guards, restore from archive, or an explicit full refresh. Archived cards are disarmed; restoring one leaves it stale and schedules a full refresh rather than silently resuming the old schedule.

## Cost model

Planning estimates use the v1 Summarizer's haiku-class default model. Provider pricing and the selected model can change actual cost.

```text
[5]{Work,Estimated usage,Estimated cost}:
  Incremental update,"1–2k input, about 0.3k output tokens",$0.003–0.006
  Busy 15-minute card over 9 hours,about 10–18 change-gated updates,$0.03–0.10/day
  Reactive worst case,6 updates/hour for 9 hours,$0.15–0.35/day per card
  Full rebuild,"5–8k input, about 1k output tokens",$0.01–0.02
  Change detection,SQL only,$0
```

Each completed generation is attributed through the normal cost ledger and copied into status-card update history. The board shows today's token and cost totals, per-update history, archived-card lifetime cost, and a create-flow estimate.

## Agent authoring

Agents with `tasks:assign` access can create status cards through the REST API. Agent-authored cards stay hidden from the v1 create UI but appear on the shared company board.

Agent authoring guardrails:

- an agent manages, refreshes, recompiles, archives, or deletes only cards it authored
- at most 20 cards per agent; deleting a card frees a slot
- an agent interest prompt is limited to 4,000 characters
- board-authored prompts keep the general 20,000-character API limit
- all routes stay company-scoped and behind `enableStatusCards`

Creating a card immediately queues the Summarizer compile run. Agents never call the query or summary write-back endpoints themselves; those endpoints accept only the assigned Summarizer generation issue and run.

Copy-pasteable agent API recipe: the bundled `status-card-query` skill.

## Temporary debug view

The debug tab exposes the interest prompt, compiled query JSON, and a dry-run result while the experimental query compiler is being tuned. Never intended as a permanent operator workflow.

Remove the dedicated debug view when all of these hold:

1. compilation failures and effective watched-task counts are diagnosable from the normal card drawer and update history
2. support can inspect the stored query and dry-run through the API without board users interpreting raw JSON
3. status-card QA has no open acceptance or regression case depending on the debug-only UI

The underlying API may remain available for support tooling after the temporary tab is removed.
