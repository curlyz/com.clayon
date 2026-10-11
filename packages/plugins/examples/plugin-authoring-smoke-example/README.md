# Plugin Authoring Smoke Example

A Clayon plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into Clayon

```bash
npx clayon plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@clayon/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
