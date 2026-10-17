import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageJsonPath = fileURLToPath(
  new URL("../../package.json", import.meta.url),
);
const runnerShimPath = fileURLToPath(
  new URL("../vendor/clayon-runner/index.ts", import.meta.url),
);
const evidenceClassifierPath = fileURLToPath(
  new URL("../services/native-runtime/evidence-classifier.ts", import.meta.url),
);
const workspaceDiffReprojectionPath = fileURLToPath(
  new URL("../services/provider-trace-workspace-diff-reprojection.ts", import.meta.url),
);

describe("server package build script", () => {
  it("builds the compiled package entry during prepack", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.prepack).toBe(
      "bun run prepare:ui-dist && bun run build",
    );
  });

  it("copies static runtime asset directories into dist", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const buildScript = packageJson.scripts?.build ?? "";

    expect(buildScript).toContain(
      "mkdir -p dist/onboarding-assets dist/built-ins",
    );
    expect(buildScript).toContain(
      "cp -R src/onboarding-assets/. dist/onboarding-assets/",
    );
    expect(buildScript).toContain("cp -R src/built-ins/. dist/built-ins/");
  });

  it("vendors the private runner runtime without a production workspace dependency", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(
      packageJson.dependencies?.["@clayon/clayon-runner"],
    ).toBeUndefined();
    expect(packageJson.devDependencies?.["@clayon/clayon-runner"]).toBe(
      "workspace:*",
    );
    expect(packageJson.scripts?.["prepare:runner-vendor"]).toBe(
      "bun run --filter @clayon/clayon-runner build",
    );
    expect(packageJson.scripts?.build).toContain(
      "cp -Rf ../packages/clayon-runner/dist/. dist/vendor/clayon-runner/",
    );
  });

  it("replaces an existing read-only image manifest with the build's copy step", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const step = packageJson.scripts.build.split(" && ").find((command: string) =>
      command.includes("../packages/clayon-runner/dist/."));
    expect(step).toBeDefined();
    const [command, ...args] = step.split(" ");
    const root = mkdtempSync(path.join(tmpdir(), "runner-vendor-copy-"));
    try {
      const relative = "remote-provider-packs/linux-x64/provider-pack.json";
      const source = path.join(root, "packages/clayon-runner/dist", relative);
      const destination = path.join(root, "server/dist/vendor/clayon-runner", relative);
      mkdirSync(path.dirname(source), { recursive: true });
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(source, "qualified image identity", { mode: 0o444 });
      writeFileSync(destination, "previous image identity", { mode: 0o444 });
      execFileSync(command, args, { cwd: path.join(root, "server") });
      expect(readFileSync(destination, "utf8")).toBe("qualified image identity");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("verifies vendored runner dependencies are mirrored before building", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    // See scripts/verify-runner-vendor-dependencies.mjs: packages/clayon-runner
    // is vendored with a raw copy of its compiled dist/, so every runtime
    // dependency it imports must also be a direct dependency of server. This
    // check derives that requirement from an esbuild scan of the vendored
    // entry points instead of relying on a human to have kept a hand-copied
    // list in sync (the smol-toml incident in #13110/#13116).
    expect(packageJson.scripts?.build).toContain(
      "node scripts/verify-runner-vendor-dependencies.mjs",
    );
  });

  it("ships the pinned OpenCode dependency resolved by the vendored Runner", () => {
    const server = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const runner = JSON.parse(readFileSync(new URL(
      "../../../packages/clayon-runner/package.json", import.meta.url,
    ), "utf8"));
    // createRequire resolution is dynamic and is not covered by the import scan.
    expect(server.dependencies["opencode-ai"]).toBe("1.18.34");
    expect(server.dependencies["opencode-ai"]).toBe(runner.dependencies["opencode-ai"]);
  });

  it("loads runner source when the source server starts before workspace builds", () => {
    const shim = readFileSync(runnerShimPath, "utf8");

    expect(shim).toContain(
      '"../../../../packages/clayon-runner/src/index.ts"',
    );
    expect(shim).not.toContain(
      'export * from "@clayon/clayon-runner"',
    );
  });

  it("routes source-mode runtime imports through the runner shim", () => {
    for (const consumerPath of [
      evidenceClassifierPath,
      workspaceDiffReprojectionPath,
    ]) {
      const consumer = readFileSync(consumerPath, "utf8");

      expect(consumer).toContain('vendor/clayon-runner/index.js"');
      expect(consumer).not.toContain('from "@clayon/clayon-runner"');
    }
  });
});
