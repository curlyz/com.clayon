import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/*
 * The OpenAPI drift gate (recipes moe:orpc/recipe-openapi-first-heygen and
 * moe:orpc/openapi-package-convention): lint the spec, re-bundle and
 * byte-compare spec.json, then regenerate from the committed spec.json into
 * a scratch dir and diff it against generated/. Any drift fails. The gate
 * never writes the committed tree.
 */

const packageDir = resolve(import.meta.dirname, "..");
let failed = false;

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: packageDir, stdio: "pipe" }).toString();

const diffOf = (a, b) => {
  try {
    return execFileSync("diff", ["-r", a, b], { stdio: "pipe" }).toString();
  } catch (error) {
    return error.stdout + error.stderr;
  }
};

try {
  run("bun", ["run", "redocly", "lint", "openapi.yaml"]);
  console.log("PASS spec lint valid");
} catch (error) {
  failed = true;
  console.error("FAIL spec lint:\n" + error.stdout + error.stderr);
}

const bundleScratch = resolve(packageDir, ".check-spec.json");
try {
  run("bun", ["run", "redocly", "bundle", "openapi.yaml", "--output", bundleScratch]);
  const diff = diffOf(bundleScratch, resolve(packageDir, "spec.json"));
  if (diff.trim() !== "") {
    failed = true;
    console.error("FAIL spec.json drifted from openapi.yaml:\n" + diff);
  } else {
    console.log("PASS spec.json matches openapi.yaml");
  }
} catch (error) {
  failed = true;
  console.error("FAIL bundle:\n" + error.stdout + error.stderr);
} finally {
  rmSync(bundleScratch, { force: true });
}

const scratch = resolve(packageDir, ".check-generated");
rmSync(scratch, { recursive: true, force: true });
try {
  run("bun", ["run", "openapi-ts", "-i", "spec.json", "-o", ".check-generated"]);
  if (!existsSync(resolve(scratch, "orpc.gen.ts"))) {
    failed = true;
    console.error("FAIL regeneration emitted no contract (openapi-ts config quirk)");
  } else {
    const diff = diffOf(scratch, resolve(packageDir, "generated"));
    if (diff.trim() !== "") {
      failed = true;
      console.error("FAIL generated/ drifted from spec.json:\n" + diff);
    } else {
      console.log("PASS generated/ matches spec.json");
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
