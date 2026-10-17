# @clayon/create-clayon-plugin

Scaffolding tool for creating new Clayon plugins.

```bash
npx @clayon/create-clayon-plugin my-plugin
```

Or with options:

```bash
npx @clayon/create-clayon-plugin @acme/my-plugin \
  --template connector \
  --category connector \
  --display-name "Acme Connector" \
  --description "Syncs Acme data into Clayon" \
  --author "Acme Inc"
```

Supported templates: `default`, `connector`, `workspace`, `environment`  
Supported categories: `connector`, `workspace`, `automation`, `ui`, `environment`

Generates:
- typed manifest + worker entrypoint
- example UI widget using the supported `@clayon/plugin-sdk/ui` hooks
- test file using `@clayon/plugin-sdk/testing`
- `esbuild` and `rollup` config files using SDK bundler presets
- dev server script for hot-reload (`clayon-plugin-dev-server`)

The scaffold starts with plain React elements so the generated plugin stays minimal. For Clayon-native controls, import shared host components such as `MarkdownEditor`, `FileTree`, `AssigneePicker`, and `ProjectPicker` from `@clayon/plugin-sdk/ui`.

Inside this repo, the generated package uses `@clayon/plugin-sdk` via `workspace:*`.

Outside this repo, the scaffold snapshots `@clayon/plugin-sdk` from your local Clayon checkout into a `.clayon-sdk/` tarball and points the generated package at that local file by default. You can override the SDK source explicitly:

```bash
node packages/plugins/create-clayon-plugin/dist/bin.js @acme/my-plugin \
  --output /absolute/path/to/plugins \
  --sdk-path /absolute/path/to/clayon/packages/plugins/sdk
```

That gives you an outside-repo local development path before the SDK is published to npm.

## Workflow after scaffolding

```bash
cd my-plugin
bun install
bun run dev       # watch worker + manifest + ui bundles
bun run dev:ui    # local UI preview server with hot-reload events
bun run test
```
