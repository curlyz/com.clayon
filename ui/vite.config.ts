import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createUiDevWatchOptions } from "./src/lib/vite-watch";
import { createApiProxy, createRemoteApiProxy } from "./src/lib/vite-api-proxy";
import { serviceWorkerBuildIdPlugin } from "./src/lib/vite-sw-build-id";
import { readBrowserBuildCommit } from "./src/lib/vite-build-commit";

// CLAYON_DEV_API_TARGET=https://clayon.curly.ng pnpm --dir ui dev:remote
// serves the working-tree UI against the deployed backend.
const remoteApiTarget = process.env.CLAYON_DEV_API_TARGET;
const apiProxy = remoteApiTarget ? createRemoteApiProxy(remoteApiTarget) : createApiProxy();

export default defineConfig(({ mode }) => ({
  define: {
    __CLAYON_BUILD_COMMIT__: JSON.stringify(
      readBrowserBuildCommit(__dirname),
    ),
  },
  plugins: [react(), tailwindcss(), serviceWorkerBuildIdPlugin()],
  build: {
    minify: "esbuild",
  },
  esbuild:
    mode === "production"
      ? {
          // React's component trace uses function names. Keep those useful in
          // error reports without publishing source maps or page context.
          keepNames: true,
          drop: ["console", "debugger"],
          legalComments: "none",
        }
      : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      lexical: path.resolve(__dirname, "./node_modules/lexical/dist/Lexical.mjs"),
    },
  },
  server: {
    port: 5173,
    watch: createUiDevWatchOptions(process.cwd()),
    proxy: apiProxy,
  },
  preview: {
    port: 3101,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
  },
}));
