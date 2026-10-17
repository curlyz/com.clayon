import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");

// bun has no `deploy` command. The runner has no workspace dependencies, so its
// production graph is a frozen, filtered, scripts-disabled install on a
// manifest-only clone of the workspace (root manifest with its overrides and
// patchedDependencies, bun.lock, bunfig.toml, patches/ and every package.json),
// using the hoisted linker so node_modules is a relocatable tree of real files.
// The runner's published files are then copied beside it.
const manifestSkippedDirectories = new Set([
  "node_modules", ".git", "dist", "target", ".turbo", "storybook-static", "doc", "docs",
]);

function copyWorkspaceManifests(sourceDirectory, targetDirectory, depth = 0) {
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && depth < 6 && !manifestSkippedDirectories.has(entry.name)) {
      copyWorkspaceManifests(join(sourceDirectory, entry.name), join(targetDirectory, entry.name), depth + 1);
    } else if (entry.isFile() && entry.name === "package.json") {
      mkdirSync(targetDirectory, { recursive: true });
      copyFileSync(join(sourceDirectory, entry.name), join(targetDirectory, entry.name));
    }
  }
}

export function deployRunnerProductionGraph(destination, stageParent) {
  const stage = join(stageParent, "workspace");
  mkdirSync(stage, { recursive: true });
  copyWorkspaceManifests(workspaceRoot, stage);
  for (const file of ["bun.lock", "bunfig.toml"]) copyFileSync(join(workspaceRoot, file), join(stage, file));
  cpSync(join(workspaceRoot, "patches"), join(stage, "patches"), { recursive: true });
  const installed = spawnSync(
    "bun",
    ["install", "--frozen-lockfile", "--production", "--ignore-scripts", "--linker", "hoisted", "--filter", "@clayon/clayon-runner"],
    { cwd: stage, encoding: "utf8", stdio: "inherit" },
  );
  if (installed.status !== 0) {
    throw new Error(`bun install failed with exit code ${installed.status}`);
  }
  mkdirSync(destination, { recursive: true });
  const runnerManifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  // Like npm's `files` field, entries that do not exist are skipped.
  for (const entry of ["package.json", ...(runnerManifest.files ?? [])]) {
    if (existsSync(join(packageRoot, entry))) {
      cpSync(join(packageRoot, entry), join(destination, entry), { recursive: true });
    }
  }
  renameSync(join(stage, "node_modules"), join(destination, "node_modules"));
  // The filtered install links the workspace package to itself. That link
  // points outside the immutable pack and is not needed by the deployed
  // package, so it must not be staged or captured.
  rmSync(join(destination, "node_modules", "@clayon", "clayon-runner"), { recursive: true, force: true });
}

// CLI: node deploy-runner-production-graph.mjs <destination>
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const destinationArgument = process.argv[2];
  if (!destinationArgument) throw new Error("usage: deploy-runner-production-graph.mjs <destination>");
  const destination = resolve(process.cwd(), destinationArgument);
  // The staging directory must live beside the destination so the final
  // rename of node_modules never crosses a filesystem boundary (EXDEV).
  const stageParent = realpathSync(mkdtempSync(join(dirname(destination), "clayon-runner-deploy-")));
  try {
    deployRunnerProductionGraph(destination, stageParent);
  } finally {
    rmSync(stageParent, { recursive: true, force: true });
  }
}
