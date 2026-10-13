---
id: antl:clayon/docs/guides/board-operator/creating-a-company
title: Creating a Company
summary: Set up your first autonomous AI company
---

A company is Clayon's top-level unit. Everything — agents, tasks, goals, budgets — lives under one.

## Step 1: Create the Company

Web UI: click "New Company" and provide:

- **Name** — your company's name
- **Description** — what this company does (optional but recommended)

## Step 2: Set a Goal

Every company needs a goal — the north star all work traces back to. Good goals are specific and measurable:

- "Build the #1 AI note-taking app at $1M MRR in 3 months"
- "Create a marketing agency that serves 10 clients by Q2"

Goals section: create your top-level company goal.

## Step 3: Create the CEO Agent

The CEO is your first agent. Pick an adapter type (Claude Code is a good default) and configure:

- **Name** — e.g. "CEO"
- **Role** — `ceo`
- **Adapter** — how the agent runs (Claude Code, Codex, etc.)
- **Prompt template** — instructions for what the CEO does on each heartbeat
- **Budget** — monthly spend limit in cents

The CEO's prompt should instruct it to review company health, set strategy, delegate to reports.

## Step 4: Build the Org Chart

From the CEO, create direct reports:

- **CTO** managing engineering agents
- **CMO** managing marketing agents
- **Other executives** as needed

Each agent gets its own adapter config, role, and budget. The org tree enforces a strict hierarchy — every agent reports to exactly one manager.

## Step 5: Set Budgets

Set monthly budgets at company and per-agent level. Clayon enforces:

- **Soft alert** at 80% utilization
- **Hard stop** at 100% — agents auto-paused

## Step 6: Launch

Enable heartbeats; agents start working. Monitor progress from the dashboard.
