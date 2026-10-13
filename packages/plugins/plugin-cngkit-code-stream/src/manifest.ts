import type { ClayonPluginManifestV1 } from "@clayon/plugin-sdk";

export const PLUGIN_ID = "clayon.cngkit-code-stream";
export const PAGE_ROUTE = "code-changes";
export const DEFAULT_CONVEX_URL = "https://cvx.curly.ng";

const manifest: ClayonPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Code Changes",
  description:
    "Live feed of file changes streamed by `cngkit git watch --convex`, read from a Convex deployment with a read-only token.",
  author: "Clayon",
  categories: ["workspace", "ui"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "instance.settings.register",
    "ui.page.register",
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      convexUrl: {
        type: "string",
        title: "Convex URL",
        description: "Client origin of the Convex deployment that receives cngkit events.",
        default: DEFAULT_CONVEX_URL,
      },
      readTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Read token",
        description: "Secret holding the deployment's CNGKIT_READ_TOKEN. It never reaches the browser.",
      },
    },
    required: ["readTokenRef"],
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "code-changes-page",
        displayName: "Code Changes",
        exportName: "CodeChangesPage",
        routePath: PAGE_ROUTE,
      },
      {
        type: "sidebar",
        id: "code-changes-sidebar",
        displayName: "Code Changes",
        exportName: "CodeChangesSidebarLink",
      },
    ],
  },
};

export default manifest;
