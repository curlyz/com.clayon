import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";
import { isSupportedNodeVersion, MINIMUM_NODE_VERSION } from "@clayon/shared/node-version";
import {
  addManagedPathBlock,
  assertManagedShimWritable,
  buildNextManifest,
  flipCurrentAtomic,
  payloadPathFor,
  pruneInstallPayloads,
  readInstallManifest,
  resolveInstallStorePaths,
  withInstallStoreLock,
  writeInstallManifestAtomic,
  writeManagedShim,
  type InstallChannel,
  type InstallRecord,
} from "../install-store.js";

const execFileAsync = promisify(execFile);
export const PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org";
const DEFAULT_GITHUB_REPO = "clayon/clayon";
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export type InstallOptions = { canary?: boolean; version?: string; ref?: string; repo?: string; yes?: boolean };

export type CommandRunner = (
  file: string,
  args: string[],
  options?: Parameters<typeof execFileAsync>[2],
) => Promise<{ stdout: string; stderr: string }>;

type ReleasePackageEntry = { dir: string; name: string };

const RELEASE_PACKAGE_MANIFEST_SCHEMA = z.array(
  z.object({ dir: z.string(), name: z.string() }),
);

const UNKNOWN_RECORD_SCHEMA = z.record(z.string(), z.unknown());

const EXEC_FILE_STDERR_SCHEMA = z.object({ stderr: z.string() });

const GITHUB_COMMIT_RESPONSE_SCHEMA = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/i),
});

const PACKAGE_VERSION_SCHEMA = z.object({ version: z.string() });

const BUNDLED_DEPENDENCIES_SCHEMA = z.object({
  bundleDependencies: z.array(z.string()).optional(),
  bundledDependencies: z.array(z.string()).optional(),
});

type BundledDependencies = z.infer<typeof BUNDLED_DEPENDENCIES_SCHEMA>;

type NpmInstallRequest = { spec: string; channel: InstallChannel };

type GitInstallRequest = { repo: string; ref: string; pinned: boolean };

type Dependencies = { runCommand?: CommandRunner; now?: () => Date };

export async function runCommandWithDiagnostics(
  file: string,
  args: string[],
  options?: Parameters<typeof execFileAsync>[2],
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(file, args, { ...options, encoding: "utf8" });
  } catch (error) {
    const parsedStderr = EXEC_FILE_STDERR_SCHEMA.safeParse(error);
    const stderr = parsedStderr.success ? parsedStderr.data.stderr.trim() : "";
    if (!stderr || (error instanceof Error && error.message.includes(stderr))) throw error;
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr}`, { cause: error });
  }
}

export function resolveGitInstallWorkspacePackages(checkoutPath: string): ReleasePackageEntry[] {
  const manifestPath = path.join(checkoutPath, "scripts", "release-package-manifest.json");
  const manifest = RELEASE_PACKAGE_MANIFEST_SCHEMA.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  const packageByName = new Map(manifest.map((entry) => [entry.name, entry]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: ReleasePackageEntry[] = [];

  const visit = (packageName: string): void => {
    if (visited.has(packageName)) return;
    if (visiting.has(packageName)) throw new Error(`Circular workspace dependency while staging ${packageName}.`);
    const entry = packageByName.get(packageName);
    if (!entry) throw new Error(`Git install cannot stage workspace dependency ${packageName}; it is missing from scripts/release-package-manifest.json.`);
    visiting.add(packageName);
    const packageJson = UNKNOWN_RECORD_SCHEMA.parse(JSON.parse(fs.readFileSync(path.join(checkoutPath, entry.dir, "package.json"), "utf8")));
    for (const section of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
      const dependencies = packageJson[section];
      if (!dependencies || typeof dependencies !== "object") continue;
      for (const dependencyName of Object.keys(dependencies)) {
        if (dependencyName.startsWith("@clayon/")) visit(dependencyName);
      }
    }
    visiting.delete(packageName);
    visited.add(packageName);
    ordered.push(entry);
  };

  visit("@clayon/server");
  return ordered;
}

export function assertSupportedNodeVersion(): void {
  if (!isSupportedNodeVersion(process.versions.node)) {
    throw new Error(`Installing or updating Clayon requires Node.js ${MINIMUM_NODE_VERSION} or newer (found ${process.version} at ${process.execPath}). Put a supported Node bin directory first on PATH and run 'npx clayon@latest install --yes' to re-pin an existing managed install.`);
  }
}

export function resolveNpmInstallRequest(options: InstallOptions): NpmInstallRequest {
  if (options.canary && options.version) throw new Error("Choose either --canary or --version, not both.");
  if (options.version) {
    const version = options.version.trim();
    if (!EXACT_VERSION_PATTERN.test(version)) {
      throw new Error(`--version requires an exact published version, received '${options.version}'.`);
    }
    return { spec: version, channel: "pinned" };
  }
  return options.canary ? { spec: "canary", channel: "canary" } : { spec: "latest", channel: "latest" };
}

function parseResolvedVersion(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("npm returned an empty version response.");
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed;
  } catch {
    if (EXACT_VERSION_PATTERN.test(trimmed)) return trimmed;
  }
  throw new Error(`npm returned an unexpected version response: ${trimmed}`);
}

export async function resolvePublishedVersion(spec: string, runCommand: CommandRunner): Promise<string> {
  const result = await runCommand(
    "npm",
    ["view", `clayon@${spec}`, "version", "--json", `--registry=${PUBLIC_NPM_REGISTRY}`],
    { maxBuffer: 1024 * 1024 },
  );
  return parseResolvedVersion(result.stdout);
}

export function resolveGitInstallRequest(options: InstallOptions): GitInstallRequest | null {
  if (!options.ref && !options.repo) return null;
  if (!options.ref) throw new Error("--repo requires --ref.");
  if (options.canary || options.version) throw new Error("--ref cannot be combined with --canary or --version.");
  const repo = (options.repo ?? DEFAULT_GITHUB_REPO).trim();
  const ref = options.ref.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error(`--repo must be an owner/name GitHub repository, received '${repo}'.`);
  if (!ref || ref.startsWith("-") || /[\0\r\n]/.test(ref)) throw new Error(`Invalid GitHub ref '${options.ref}'.`);
  return { repo, ref, pinned: /^[0-9a-f]{7,40}$/i.test(ref) };
}

async function runGitHubCurl(
  args: string[],
  runCommand: CommandRunner,
  options?: Parameters<CommandRunner>[2],
): Promise<{ stdout: string; stderr: string }> {
  // Anonymous GitHub requests are rate-limited per source IP (CI runners and
  // corporate NAT exhaust the shared quota); honor an ambient token when present.
  // The token travels via a curl --config file so it never appears in process args.
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) return runCommand("curl", args, options);
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "clayon-gh-"));
  const configFile = path.join(configDir, "headers");
  try {
    fs.writeFileSync(configFile, `header = "Authorization: Bearer ${token}"\n`, { mode: 0o600 });
    return await runCommand("curl", ["--config", configFile, ...args], options);
  } finally {
    fs.rmSync(configDir, { recursive: true, force: true });
  }
}

export async function resolveGitHubRef(repo: string, ref: string, runCommand: CommandRunner): Promise<string> {
  const result = await runGitHubCurl(["--fail", "--silent", "--show-error", "--location", "--header", "Accept: application/vnd.github+json", "--header", "User-Agent: clayon-install", `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`], runCommand, { maxBuffer: 4 * 1024 * 1024 });
  let raw: unknown;
  try { raw = JSON.parse(result.stdout); } catch { throw new Error(`GitHub returned an invalid response while resolving ${repo}@${ref}.`); }
  const parsed = GITHUB_COMMIT_RESPONSE_SCHEMA.safeParse(raw);
  if (!parsed.success) throw new Error(`GitHub did not return a full commit SHA for ${repo}@${ref}.`);
  return parsed.data.sha.toLowerCase();
}

function payloadEntrypoint(payloadPath: string): string {
  return path.join(payloadPath, "node_modules", "clayon", "dist", "index.js");
}

export async function smokePayload(payloadPath: string, expectedVersion: string, runCommand: CommandRunner): Promise<void> {
  const entrypoint = payloadEntrypoint(payloadPath);
  if (!fs.existsSync(entrypoint)) throw new Error(`Installed package is missing its CLI entrypoint: ${entrypoint}`);
  const result = await runCommand(process.execPath, [entrypoint, "--version"], { maxBuffer: 1024 * 1024 });
  const reportedVersion = result.stdout.trim().split(/\s+/)[0];
  if (reportedVersion !== expectedVersion) {
    throw new Error(`Installed CLI smoke check reported ${reportedVersion || "no version"}; expected ${expectedVersion}.`);
  }
}

export async function installNpmPayload(
  version: string,
  runCommand: CommandRunner,
  paths = resolveInstallStorePaths(),
): Promise<{ payloadPath: string; reused: boolean }> {
  const payloadPath = payloadPathFor(paths, "npm", version);
  if (fs.existsSync(payloadPath)) {
    await smokePayload(payloadPath, version, runCommand);
    return { payloadPath, reused: true };
  }
  const sourceRoot = path.dirname(payloadPath);
  fs.mkdirSync(sourceRoot, { recursive: true, mode: 0o700 });
  const sourceStat = fs.lstatSync(sourceRoot);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new Error(`Refusing to install into unsafe payload root ${sourceRoot}.`);
  }
  fs.chmodSync(paths.cliRoot, 0o700);
  fs.chmodSync(paths.installsRoot, 0o700);
  fs.chmodSync(sourceRoot, 0o700);
  const stagingPath = path.join(sourceRoot, `.${version}.tmp-${process.pid}-${Date.now()}`);
  const npmUserConfigPath = path.join(sourceRoot, `.npmrc-${process.pid}-${Date.now()}`);
  fs.rmSync(stagingPath, { recursive: true, force: true });
  try {
    fs.writeFileSync(
      npmUserConfigPath,
      `registry=${PUBLIC_NPM_REGISTRY}\n@clayon:registry=${PUBLIC_NPM_REGISTRY}\n`,
      { mode: 0o600 },
    );
    await runCommand(
      "npm",
      [
        "install",
        "--prefix",
        stagingPath,
        `clayon@${version}`,
        `--registry=${PUBLIC_NPM_REGISTRY}`,
        `--@clayon:registry=${PUBLIC_NPM_REGISTRY}`,
        "--no-audit",
        "--no-fund",
      ],
      {
        cwd: sourceRoot,
        env: { ...process.env, npm_config_userconfig: npmUserConfigPath },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    await smokePayload(stagingPath, version, runCommand);
    fs.renameSync(stagingPath, payloadPath);
    return { payloadPath, reused: false };
  } finally {
    fs.rmSync(stagingPath, { recursive: true, force: true });
    fs.rmSync(npmUserConfigPath, { force: true });
  }
}

function gitBuildEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  // Source builds need devDependencies (esbuild, typescript); ambient NODE_ENV=production
  // makes bun/npm omit them, so the checkout build must not inherit it.
  delete env.NODE_ENV;
  return env;
}

export async function installGitPayload(repo: string, sha: string, runCommand: CommandRunner, paths = resolveInstallStorePaths()): Promise<{ payloadPath: string; reused: boolean; version: string }> {
  const identifier = sha.slice(0, 12);
  const payloadPath = payloadPathFor(paths, "git", identifier);
  if (fs.existsSync(payloadPath)) {
    const metadata = PACKAGE_VERSION_SCHEMA.parse(JSON.parse(fs.readFileSync(path.join(payloadPath, "node_modules", "clayon", "package.json"), "utf8")));
    await smokePayload(payloadPath, metadata.version, runCommand);
    return { payloadPath, reused: true, version: metadata.version };
  }
  const sourceRoot = path.dirname(payloadPath);
  fs.mkdirSync(sourceRoot, { recursive: true, mode: 0o700 });
  const sourceStat = fs.lstatSync(sourceRoot);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new Error(`Refusing to install into unsafe payload root ${sourceRoot}.`);
  }
  fs.chmodSync(paths.cliRoot, 0o700);
  fs.chmodSync(paths.installsRoot, 0o700);
  fs.chmodSync(sourceRoot, 0o700);
  const stagingRoot = path.join(sourceRoot, `.${identifier}.tmp-${process.pid}-${Date.now()}`);
  const checkoutPath = path.join(stagingRoot, "source");
  const archivePath = path.join(stagingRoot, "source.tar.gz");
  const stagedPayload = path.join(stagingRoot, "payload");
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(checkoutPath, { recursive: true, mode: 0o700 });
  try {
    await runGitHubCurl(["--fail", "--silent", "--show-error", "--location", "--output", archivePath, `https://codeload.github.com/${repo}/tar.gz/${sha}`], runCommand, { maxBuffer: 4 * 1024 * 1024 });
    await runCommand("tar", ["-xzf", archivePath, "--strip-components=1", "-C", checkoutPath], { maxBuffer: 4 * 1024 * 1024 });
    if (!fs.existsSync(path.join(checkoutPath, "bun.lock"))) {
      throw new Error(`The checked-out ref ${sha.slice(0, 12)} predates bun.lock; pin a post-migration sha.`);
    }
    await runCommand("bun", ["install", "--frozen-lockfile"], { cwd: checkoutPath, env: gitBuildEnv(), maxBuffer: 32 * 1024 * 1024 });
    await runCommand("bash", ["scripts/build-npm.sh", "--skip-checks", "--skip-typecheck"], { cwd: checkoutPath, env: gitBuildEnv(), maxBuffer: 32 * 1024 * 1024 });
    const metadata = PACKAGE_VERSION_SCHEMA.parse(JSON.parse(fs.readFileSync(path.join(checkoutPath, "cli", "package.json"), "utf8")));
    const workspacePackages = resolveGitInstallWorkspacePackages(checkoutPath);
    await runCommand("bun", ["run", ...workspacePackages.flatMap((workspacePackage) => ["--filter", workspacePackage.name]), "build"], { cwd: checkoutPath, env: gitBuildEnv(), maxBuffer: 32 * 1024 * 1024 });
    for (const [index, workspacePackage] of workspacePackages.entries()) {
      const packageDir = path.join(checkoutPath, workspacePackage.dir);
      const packageJson: BundledDependencies = BUNDLED_DEPENDENCIES_SCHEMA.parse(JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8")));
      const bundledDependencies = packageJson.bundleDependencies ?? packageJson.bundledDependencies ?? [];
      if (bundledDependencies.length > 0) {
        const stagedPackage = path.join(stagingRoot, `workspace-package-${index}`);
        await runCommand(process.execPath, [path.join(checkoutPath, "scripts", "prepare-bundled-package.mjs"), packageDir, stagedPackage], { cwd: checkoutPath, env: gitBuildEnv(), maxBuffer: 32 * 1024 * 1024 });
        await runCommand("npm", ["pack", stagedPackage, "--pack-destination", stagingRoot], { cwd: checkoutPath, env: gitBuildEnv(), maxBuffer: 16 * 1024 * 1024 });
      } else {
        await runCommand("bun", ["pm", "pack", "--destination", stagingRoot], { cwd: packageDir, env: gitBuildEnv({ CLAYON_RELEASE_REUSE_UI_DIST: "1" }), maxBuffer: 32 * 1024 * 1024 });
      }
    }
    await runCommand("npm", ["pack", "--pack-destination", stagingRoot], { cwd: path.join(checkoutPath, "cli"), env: gitBuildEnv(), maxBuffer: 16 * 1024 * 1024 });
    const tarballs = fs.readdirSync(stagingRoot).filter((entry) => entry.endsWith(".tgz"));
    const cliTarball = tarballs.find((entry) => entry === `clayon-${metadata.version}.tgz`);
    const workspaceTarballs = tarballs.filter((entry) => entry !== cliTarball);
    if (!cliTarball || workspaceTarballs.length !== workspacePackages.length) {
      throw new Error(`Git install packaging produced ${workspaceTarballs.length} workspace tarballs; expected ${workspacePackages.length}.`);
    }
    await runCommand("npm", ["install", "--prefix", stagedPayload, path.join(stagingRoot, cliTarball), ...workspaceTarballs.map((entry) => path.join(stagingRoot, entry)), "--no-audit", "--no-fund"], { cwd: stagingRoot, maxBuffer: 32 * 1024 * 1024 });
    await smokePayload(stagedPayload, metadata.version, runCommand);
    fs.renameSync(stagedPayload, payloadPath);
    return { payloadPath, reused: false, version: metadata.version };
  } finally { fs.rmSync(stagingRoot, { recursive: true, force: true }); }
}

function pathContains(directory: string): boolean {
  const normalized = path.resolve(directory);
  return (process.env.PATH ?? "").split(path.delimiter).filter(Boolean).some((entry) => path.resolve(entry) === normalized);
}

function shellRcPath(): string | null {
  const home = process.env.HOME;
  if (!home) return null;
  const shell = path.basename(process.env.SHELL ?? "");
  if (shell === "bash") return path.join(home, ".bashrc");
  if (shell === "zsh") return path.join(home, ".zshrc");
  return null;
}

async function ensureShimOnPath(options: InstallOptions): Promise<void> {
  const paths = resolveInstallStorePaths();
  const binDir = path.dirname(paths.shimPath);
  if (pathContains(binDir)) return;
  const manualInstruction = `export PATH="$HOME/.local/bin:$PATH"`;
  const rcPath = shellRcPath();
  if (!process.stdin.isTTY || !process.stdout.isTTY || !rcPath) {
    console.log(pc.yellow(`Add Clayon to PATH for this shell:\n  ${manualInstruction}`));
    return;
  }
  const confirmed = options.yes === true ? true : await p.confirm({ message: `Add ~/.local/bin to PATH in ${rcPath}?`, initialValue: true });
  if (p.isCancel(confirmed) || !confirmed) {
    console.log(pc.yellow(`PATH was not changed. Run:\n  ${manualInstruction}`));
    return;
  }
  const changed = addManagedPathBlock(rcPath);
  console.log(changed ? pc.green(`Updated ${rcPath}.`) : pc.dim(`${rcPath} already contains the PATH block.`));
}

async function confirmGitInstall(options: InstallOptions, repo: string, ref: string): Promise<void> {
  const warning = `Installing ${repo}@${ref} executes dependency and build scripts from that repository.`;
  console.log(pc.yellow(`Warning: ${warning}`));
  if (options.yes === true) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${warning} Re-run with --yes to consent in non-interactive environments.`);
  }
  const confirmed = await p.confirm({
    message: `${warning} Continue?`,
    initialValue: false,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    throw new Error("Git-ref install cancelled before downloading or executing repository code.");
  }
}

export async function installCommand(
  options: InstallOptions,
  dependencies: Dependencies = {},
): Promise<void> {
  assertSupportedNodeVersion();
  const runCommand = dependencies.runCommand ?? runCommandWithDiagnostics;
  const gitRequest = resolveGitInstallRequest(options);
  if (gitRequest) {
    await confirmGitInstall(options, gitRequest.repo, gitRequest.ref);
    const sha = await resolveGitHubRef(gitRequest.repo, gitRequest.ref, runCommand);
    const paths = resolveInstallStorePaths();
    const installed = await withInstallStoreLock(async () => {
      assertManagedShimWritable(paths);
      const currentManifest = readInstallManifest(paths);
      const payload = await installGitPayload(gitRequest.repo, sha, runCommand, paths);
      const record: InstallRecord = { source: "git", version: payload.version, channel: "pinned", repo: gitRequest.repo, ref: gitRequest.ref, sha, payloadPath: payload.payloadPath, installedAt: (dependencies.now?.() ?? new Date()).toISOString() };
      const nextManifest = buildNextManifest(record, currentManifest);
      const oldTarget = fs.existsSync(paths.currentPath) ? fs.readlinkSync(paths.currentPath) : null;
      flipCurrentAtomic(payload.payloadPath, paths);
      try { writeInstallManifestAtomic(nextManifest, paths); } catch (error) { if (oldTarget) flipCurrentAtomic(path.resolve(paths.cliRoot, oldTarget), paths); else fs.rmSync(paths.currentPath, { force: true }); throw error; }
      writeManagedShim(paths); pruneInstallPayloads(nextManifest, paths); return payload;
    }, paths);
    await ensureShimOnPath(options);
    console.log(pc.green(`${installed.reused ? "Activated cached" : "Installed"} clayon git payload ${sha.slice(0, 12)}.`));
    return;
  }
  const request = resolveNpmInstallRequest(options);
  console.log(`Resolving clayon@${request.spec} from ${PUBLIC_NPM_REGISTRY}...`);
  const version = await resolvePublishedVersion(request.spec, runCommand);
  console.log(`Installing clayon@${version}...`);

  const paths = resolveInstallStorePaths();
  const installed = await withInstallStoreLock(async () => {
    assertManagedShimWritable(paths);
    const currentManifest = readInstallManifest(paths);
    const payload = await installNpmPayload(version, runCommand, paths);
    const record: InstallRecord = {
      source: "npm",
      version,
      channel: request.channel,
      payloadPath: payload.payloadPath,
      installedAt: (dependencies.now?.() ?? new Date()).toISOString(),
    };
    const nextManifest = buildNextManifest(record, currentManifest);
    const oldTarget = fs.existsSync(paths.currentPath) ? fs.readlinkSync(paths.currentPath) : null;
    flipCurrentAtomic(payload.payloadPath, paths);
    try {
      writeInstallManifestAtomic(nextManifest, paths);
    } catch (error) {
      if (oldTarget) flipCurrentAtomic(path.resolve(paths.cliRoot, oldTarget), paths);
      else fs.rmSync(paths.currentPath, { force: true });
      throw error;
    }
    writeManagedShim(paths);
    pruneInstallPayloads(nextManifest, paths);
    return payload;
  }, paths);
  await ensureShimOnPath(options);

  console.log(pc.green(`${installed.reused ? "Activated cached" : "Installed"} clayon ${version} (${request.channel}).`));
  console.log(pc.dim(`Payload: ${installed.payloadPath}`));
  console.log(`Run ${pc.cyan("clayon --version")} to verify the managed install.`);
}
