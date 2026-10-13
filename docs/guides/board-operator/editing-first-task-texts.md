---
id: antl:clayon/docs/guides/board-operator/editing-first-task-texts
title: Editing the First-Task Texts
summary: Change the welcome, instructions, and proposal style for new organizations
---

A new organization's first-task text lives in `server/src/onboarding-assets/first-task/`. Plain Markdown — maintainers change it without touching TypeScript.

## Files and placeholders

```text
[6]{File,Purpose}:
  `greeting.md`,The welcome the user sees.
  `brief.md`,The hidden `/first-task` skill invocation. Contains `{{proposalMode}}`.
  `skills/first-task/SKILL.md`,"The first-task instructions, including both proposal modes."
  `opening-question.json`,The opening card: its prompt and two options.
  `chief-of-staff/AGENTS.md`,The first agent's chief-of-staff persona.
  `README.md`,"A maintainer reference for the files, placeholders, toggle, and update behavior."
```

The templates support `{{agentName}}`, `{{organizationName}}`, and `{{proposalMode}}`. Clayon fills them when creating the first agent and first task. Proposal mode is `confirmation` or `plan`; full policy lives in the skill.

## How the first-task flow works

The server posts the greeting and an opening card with two options. Nothing runs until the user answers the card or writes a message.

The first agent receives the `first-task` skill automatically. The first task's hidden description tells it to read and follow that skill; the user never types `/first-task`. The skill also applies to later replies on that onboarding task, never to the agent's other tasks.

- **Interview me:** the agent asks 3–4 questions in one card, then proposes a plan and a team.
- **I have a task in mind:** the typed text is the task. Clear enough: proposes right away. Otherwise 2–3 clarifying questions first.
- A plain message instead of an answer counts as a task.

The agent may create hires or tasks only after the user accepts a confirmation or checkbox card.

## Apply an edit

Edit the Markdown with GitHub's web editor or locally, open a pull request, merge. A local instance loads the change after its next server restart; Cloud tenants get it with the next release.

An existing first task keeps its stored description, and an existing first agent keeps its instruction file. The skill is assigned automatically to new onboarding agents; existing agents are never migrated. Edit an agent's copy of its persona in the app under **Instructions**.

Skill edits follow normal bundled-skill refresh: agents already assigned the unpinned `first-task` skill receive its updated policy. The proposal mode saved in each task stays the same.

## Choose the proposal form

**Settings > Experimental**: **First task: propose with a plan document**. Setting key `enableFirstTaskPlanProposal`, off by default.

- **Off:** the chief of staff answers a single-task request with one confirmation card.
- **On:** the chief of staff writes a short plan document and adds a checkbox card.

Clayon reads this setting once, when creating an organization's first task. Changing it later never alters an existing first task.
