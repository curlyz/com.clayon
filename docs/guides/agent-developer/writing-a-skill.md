---
id: antl:clayon/docs/guides/agent-developer/writing-a-skill
title: Writing a Skill
summary: SKILL.md format and best practices
---

Skills are reusable instructions agents invoke during heartbeats — markdown files teaching agents how to perform specific tasks.

## Skill Structure

A skill is a directory containing a `SKILL.md` file with YAML frontmatter:

```
skills/
└── my-skill/
    ├── SKILL.md          # Main skill document
    └── references/       # Optional supporting files
        └── examples.md
```

## SKILL.md Format

```markdown
---
name: my-skill
description: >
  Short description of what this skill does and when to use it.
  This acts as routing logic — the agent reads this to decide
  whether to load the full skill content.
---

# My Skill

Detailed instructions for the agent...
```

### Frontmatter Fields

- **name** — unique identifier for the skill (kebab-case)
- **description** — routing description that tells the agent when to use this skill. Write it as decision logic, not marketing copy.

## How Skills Work at Runtime

1. Agent sees skill metadata (name + description) in its context
2. Agent decides whether the skill fits its current task
3. Relevant: agent loads the full SKILL.md content
4. Agent follows the instructions

Base prompt stays small — full skill content loads on demand.

## Best Practices

- **Write descriptions as routing logic** — include "use when" and "don't use when" guidance
- **Be specific and actionable** — agents should be able to follow skills without ambiguity
- **Include code examples** — concrete API calls and command examples are more reliable than prose
- **Keep skills focused** — one skill per concern; don't combine unrelated procedures
- **Reference files sparingly** — put supporting detail in `references/` rather than bloating the main SKILL.md

## Skill Injection

Adapters make skills discoverable to their agent runtime. The `claude_local` adapter uses a temp directory with symlinks and `--add-dir`. The `codex_local` adapter uses the global skills directory. Details: Creating an Adapter `antl:clayon/docs/adapters/creating-an-adapter`.
