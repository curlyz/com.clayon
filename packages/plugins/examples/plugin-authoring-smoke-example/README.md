# Plugin Authoring Smoke Example

A Clayon plugin

## Development

```bash
bun install
bun run dev            # watch builds
bun run dev:ui         # local dev server with hot-reload events
bun run test
```

## Install Into Clayon

```bash
npx clayon plugin install ./
```

## Build Options

- `bun run build` uses esbuild presets from `@clayon/plugin-sdk/bundlers`.
- `bun run build:rollup` uses rollup presets from the same SDK.
