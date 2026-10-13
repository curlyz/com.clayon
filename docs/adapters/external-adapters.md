---
id: antl:clayon/docs/adapters/external-adapters
title: External Adapters
summary: Build, package, and distribute adapters as plugins without modifying Clayon source
---

Clayon supports external adapter plugins installed from npm packages or local directories. External adapters work like built-in adapters — execute agents, parse output, render transcripts — but live in their own package. No Clayon source changes required.

## Built-in vs External

```text
[5]{,Built-in,External}:
  "Source location","Inside `clayon-fork/packages/adapters/`","Separate npm package or local directory"
  Registration,Hardcoded in three registries,"Loaded at startup via plugin system"
  UI parser,"Static import at build time","Dynamically loaded from API (see UI Parser `antl:clayon/docs/adapters/adapter-ui-parser`)"
  Distribution,"Ships with Clayon","Published to npm or linked via `file:`"
  Updates,Requires Clayon release,Independent versioning
```

### Built-in Hermes compatibility note

Hermes is built in with two stable adapter type keys:

- `hermes_local` starts the local Hermes CLI from
  `@clayon/hermes-clayon-adapter`.
- `hermes_gateway` calls an already-running Hermes API server through
  `@clayon/hermes-clayon-adapter/gateway`.

The legacy `@clayon/adapter-hermes-gateway` package is a deprecated
compatibility shim for one release: preserves old gateway exports, forwards to
the unified Hermes package. New override packages should depend on or link
`@clayon/hermes-clayon-adapter` and declare the overridden type
(`hermes_local` or `hermes_gateway`); type keys did not change.

## Quick Start

### Minimal Package Structure

```
my-adapter/
  package.json
  tsconfig.json
  src/
    index.ts            # Shared metadata (type, label, models)
    server/
      index.ts          # createServerAdapter() factory
      execute.ts        # Core execution logic
      parse.ts          # Output parsing
      test.ts           # Environment diagnostics
    ui-parser.ts        # Self-contained UI transcript parser
```

### package.json

```json
{
  "name": "my-clayon-adapter",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "clayon": {
    "adapterUiParser": "1.0.0"
  },
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/server/index.js",
    "./ui-parser": "./dist/ui-parser.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@clayon/adapter-utils": "^2026.325.0",
    "picocolors": "^1.1.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.7.0"
  }
}
```

Key fields:

- **`exports["."]`** — Entry point — must export `createServerAdapter`
- **`exports["./ui-parser"]`** — Self-contained UI parser module (optional but recommended)
- **`clayon.adapterUiParser`** — Contract version for the UI parser (`"1.0.0"`)
- **`files`** — Limits what gets published — only `dist/`

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## Server Module

The plugin loader calls `createServerAdapter()` from your package root. It must return a `ServerAdapterModule`.

### src/index.ts

```ts
export const type = "my_adapter";     // snake_case, globally unique
export const label = "My Agent";

export const models = [
  { id: "model-a", label: "Model A" },
];

export const agentConfigurationDoc = `# my_adapter configuration
Use when: ...
Don't use when: ...
`;

// Required by plugin-loader convention
export { createServerAdapter } from "./server/index.js";
```

### src/server/index.ts

```ts
import type { ServerAdapterModule } from "@clayon/adapter-utils";
import { type, models, agentConfigurationDoc } from "../index.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    models,
    agentConfigurationDoc,
  };
}
```

### src/server/execute.ts

The core execution function. Receives `AdapterExecutionContext`, returns `AdapterExecutionResult`.

```ts
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@clayon/adapter-utils";

import {
  runChildProcess,
  buildClayonEnv,
  renderTemplate,
} from "@clayon/adapter-utils/server-utils";

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const { config, agent, runtime, context, onLog, onMeta } = ctx;

  // 1. Read config with safe helpers
  const cwd = String(config.cwd ?? "/tmp");
  const command = String(config.command ?? "my-agent");
  const timeoutSec = Number(config.timeoutSec ?? 300);

  // 2. Build environment with Clayon vars injected
  const env = buildClayonEnv(agent);

  // 3. Render prompt template
  const prompt = config.promptTemplate
    ? renderTemplate(String(config.promptTemplate), {
        agentId: agent.id,
        agentName: agent.name,
        companyId: agent.companyId,
        runId: ctx.runId,
        taskId: context.taskId ?? "",
        taskTitle: context.taskTitle ?? "",
      })
    : "Continue your work.";

  // 4. Spawn process
  const result = await runChildProcess(command, {
    args: [prompt],
    cwd,
    env,
    timeout: timeoutSec * 1000,
    graceMs: 10_000,
    onStdout: (chunk) => onLog("stdout", chunk),
    onStderr: (chunk) => onLog("stderr", chunk),
  });

  // 5. Return structured result
  return {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    // Include session state for persistence
    sessionParams: { /* ... */ },
  };
}
```

#### Available Helpers from `@clayon/adapter-utils`

- **`runChildProcess(command, opts)`** — Spawn a child process with timeout, grace period, and streaming callbacks
- **`buildClayonEnv(agent)`** — Inject `CLAYON_*` environment variables
- **`renderTemplate(template, data)`** — `{{variable}}` substitution in prompt templates
- **`asString(v)`, `asNumber(v)`, `asBoolean(v)`** — Safe config value extraction

### src/server/test.ts

Validates adapter config before running. Returns structured diagnostics.

```ts
import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@clayon/adapter-utils";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks = [];

  // Example: check CLI is installed
  checks.push({
    level: "info",
    message: "My Agent CLI v1.2.0 detected",
    code: "cli_detected",
  });

  // Example: check working directory
  const cwd = String(ctx.config.cwd ?? "");
  if (!cwd.startsWith("/")) {
    checks.push({
      level: "error",
      message: `Working directory must be absolute: "${cwd}"`,
      hint: "Use /home/user/project or /workspace",
      code: "invalid_cwd",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: checks.some(c => c.level === "error") ? "fail" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
```

Check levels:

- **`info`** — Informational — Shown in test results
- **`warn`** — Non-blocking issue — Shown with yellow indicator
- **`error`** — Blocks execution — Prevents agent from running

## Installation

### From npm

```sh
# Via the Clayon UI
# Settings → Adapters → Install from npm → "my-clayon-adapter"

# Or via API
curl -X POST http://localhost:3102/api/adapters \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"packageName": "my-clayon-adapter"}'
```

### From local directory

```sh
curl -X POST http://localhost:3102/api/adapters \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"localPath": "/home/user/my-adapter"}'
```

Local adapters are symlinked into Clayon's adapter directory. Source changes picked up on server restart.

### Via adapter-plugins.json

For development, edit `~/.clayon/adapter-plugins.json` directly:

```json
[
  {
    "packageName": "my-clayon-adapter",
    "localPath": "/home/user/my-adapter",
    "type": "my_adapter",
    "installedAt": "2026-03-30T12:00:00.000Z"
  }
]
```

## Optional: Session Persistence

If your runtime supports sessions (conversation continuity across heartbeats), implement a session codec:

```ts
import type { AdapterSessionCodec } from "@clayon/adapter-utils";

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    return r.sessionId ? { sessionId: String(r.sessionId) } : null;
  },
  serialize(params) {
    return params?.sessionId ? { sessionId: String(params.sessionId) } : null;
  },
  getDisplayId(params) {
    return params?.sessionId ? String(params.sessionId) : null;
  },
};
```

Include it in `createServerAdapter()`:

```ts
return { type, execute, testEnvironment, sessionCodec, /* ... */ };
```

## Optional: Skills Sync

If your runtime supports skills/plugins, implement `listSkills` and `syncSkills`:

```ts
return {
  type,
  execute,
  testEnvironment,
  async listSkills(ctx) {
    return {
      adapterType: ctx.adapterType,
      supported: true,
      mode: "ephemeral",
      desiredSkills: [],
      entries: [],
      warnings: [],
    };
  },
  async syncSkills(ctx, desiredSkills) {
    // Install desired skills into the runtime
    return { /* same shape as listSkills */ };
  },
};
```

## Optional: Model Detection

If your runtime has a local config file specifying the default model:

```ts
async function detectModel() {
  // Read ~/.my-agent/config.yaml or similar
  return {
    model: "anthropic/claude-sonnet-4",
    provider: "anthropic",
    source: "~/.my-agent/config.yaml",
    candidates: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
  };
}

return { type, execute, testEnvironment, detectModel: () => detectModel() };
```

## Publishing

```sh
npm run build
npm publish
```

Users install your adapter by package name from UI or API.

## Security

- Treat agent output as untrusted — parse defensively, never `eval()` agent output
- Inject secrets via environment variables, not in prompts
- Configure network access controls if the runtime supports them
- Always enforce timeout and grace period — don't let agents run forever
- The UI parser module runs in a browser sandbox — zero runtime imports, no side effects

## Next Steps

- UI Parser Contract `antl:clayon/docs/adapters/adapter-ui-parser` — custom run-log parser so the UI renders adapter output correctly
- Creating an Adapter `antl:clayon/docs/adapters/creating-an-adapter` — full walkthrough of adapter internals
- How Agents Work `antl:clayon/docs/guides/agent-developer/how-agents-work` — the heartbeat lifecycle your adapter serves
