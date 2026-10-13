# @clayon/plugin-cngkit-code-stream

A "Code Changes" page for the Clayon board: a live list of file changes streamed by
`cngkit git watch --convex`, each expandable to its patch. The plugin worker reads a Convex
deployment over its HTTP query API with a read-only token; the token never reaches the browser.

Private package (not published to npm). It ships in the Clayon image as source and is installed from
the bundled catalog like `plugin-workspace-diff`.

## Setup after deploy

1. Create a company secret holding the deployment's `CNGKIT_READ_TOKEN`
   (`servers/contabo-eu-vps6/.secrets/cngkit-convex.env`; never paste it into chat or a doc).
2. Install the plugin (Plugins page, or `clayon plugin install <path>`).
3. In the plugin settings set **Convex URL** (`https://cvx.curly.ng`) and pick the secret as
   **Read token**.
4. Run `cngkit git watch --convex` on the machine whose repositories you want to observe. The
   sidebar entry **Code Changes** shows events within about two seconds.

## Shape

| file | job |
| --- | --- |
| `src/manifest.ts` | capabilities `http.outbound`, `secrets.read-ref`, page + sidebar slots, config schema |
| `src/contracts.ts` | zod schemas for config, Convex responses and worker params |
| `src/convex-query.ts` | one Convex query call: resolve secret, POST `/api/query`, parse |
| `src/worker.ts` | data handlers `code-changes`, `repositories`, `change` |
| `src/ui/index.tsx` | page (polls every 2 s while visible) and sidebar link |

The page polls because the plugin bridge has no server push for Convex yet. Events reach Convex
immediately; two seconds is the display delay.

Convex functions live in `packages/cngkit/apps/convex` (outside this repo).
