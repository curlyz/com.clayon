import { defineConfig } from "@hey-api/openapi-ts";

// The spec is the contract (recipe moe:orpc/recipe-openapi-first-heygen).
// `redocly bundle` folds openapi.yaml into spec.json and this config
// regenerates the oRPC contract (and its zod schemas) from that bundle into
// generated/ — never edit generated/ by hand. `bun run check` in this package
// (alias `bun run check:openapi` at the com.paperclip root) fails if generated/
// or spec.json drifts from openapi.yaml.
export default defineConfig({
  input: "spec.json",
  output: "generated",
  plugins: [{ name: "orpc", compatibilityVersion: "2", validator: "zod" }],
});
