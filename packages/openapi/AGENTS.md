# @clayon/openapi

The OpenAPI contract of the Paperclip gateway, and nothing else (operator,
2026-10-17: "all packages/contract must be renamed to packages/openapi , and
follow a single convention of structure"). Convention owner:
`moe:orpc/openapi-package-convention`; split method: `moe:orpc/recipe-split-openapi`.
The com.paperclip root `AGENTS.md` still wins inside com.paperclip.

## tree

```text
openapi.yaml          root: info, servers, $ref to paths/ and components/schemas/
paths/                one file per URL, all verbs; segments joined by `_`, params in braces
components/schemas/   one schema per file, PascalCase, file name = $ref key
spec.json             redocly bundle, committed, served byte-equal at /api/openapi.json
generated/            Hey API output from spec.json (orpc.gen.ts, zod.gen.ts), never edited
scripts/check.mjs     the drift gate
redocly.yaml          lint rules; each override carries its reason
openapi-ts.config.ts  input spec.json
```

## rules

- Edit YAML only. Register every new schema in the root `components.schemas`, or the bundle drops it.
- `bun run generate` after any spec edit (bundle, then Hey API). `bun run check` must pass before commit; the root alias is `bun run check:openapi`.
- Exports: `.` oRPC contract, `./zod` schemas, `./spec.json`.
- operationIds are load-bearing (`health`, `listAgents`, `readAgent`); never rename one.

## deviations

- Responses keep the `{ data, meta }` shape (`Health`, `AgentList`, `AgentEnvelope`). The convention retires the envelope (operator, 2026-10-17); removing it changes the wire shape of the gateway and is a separate contract change, not part of this rename.
- The former package-local `oxlint`/`oxfmt` scripts were dropped: the package holds only YAML and generated code, and `lint` now means `redocly lint`.
