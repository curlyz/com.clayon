#!/usr/bin/env node
/**
 * Direct image build for the paperclip VPS deploy: build the Dockerfile
 * production target on this Mac for linux/amd64 and push it to the private
 * GHCR package ghcr.io/curlyz/paperclip. The VPS (Dokploy) then deploys by
 * pulling the pinned sha tag — no server-side build.
 *
 * Usage: node scripts/buildImage.mjs            (builds current HEAD)
 *        node scripts/buildImage.mjs <sha>      (builds a given commit —
 *                                                checks it out first)
 *
 * Auth: `gh auth token` feeds docker login through stdin; the token never
 * appears in argv, env, or logs.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const imageName = "ghcr.io/curlyz/paperclip";

const requestedSha = process.argv[2];
if (requestedSha) {
  execFileSync("git", ["checkout", requestedSha], { cwd: repoRoot, stdio: "inherit" });
}
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const short = sha.slice(0, 12);
console.log(`Building ${imageName}:${short} (${sha}) for linux/amd64…`);

// docker login via stdin so the gh token never lands in argv or env.
const login = spawnSync("sh", ["-c", `gh auth token | docker login ghcr.io -u curlyz --password-stdin`], {
  cwd: repoRoot,
  stdio: ["ignore", "inherit", "inherit"],
});
if (login.status !== 0) process.exit(login.status ?? 1);

execFileSync(
  "docker",
  [
    "buildx", "build",
    "--platform", "linux/amd64",
    "--target", "production",
    "--build-arg", `PAPERCLIP_BUILD_COMMIT=${sha}`,
    "--tag", `${imageName}:${short}`,
    "--tag", `${imageName}:latest`,
    "--push",
    ".",
  ],
  { cwd: repoRoot, stdio: "inherit" },
);

console.log(`\nPushed ${imageName}:${short} and :latest.`);
console.log(`Compose pin: image: ${imageName}:${sha}`);
