#!/usr/bin/env -S node --import tsx
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createCapturedOutputBuffer, parseJsonResponseWithLimit } from "./dev-runner-output.ts";
import {
  clayonRunnerBinaryNeedsBuild,
  resolveNativeRunnerRequirement,
} from "./dev-runner-native-binary.mjs";
import { applyDevRunnerOptions } from "./dev-runner-options.ts";
import { collectWatchedSnapshot as collectDevServerWatchedSnapshot, diffSnapshots } from "./dev-runner-snapshot.mjs";
import { createDevServiceIdentity, repoRoot } from "./dev-service-profile.ts";
import { bootstrapDevRunnerWorktreeEnv, isWorktreeSeedPending } from "../server/src/dev-runner-worktree.ts";
import {
  readDevServerRestartRequest,
  removeDevServerRestartRequest,
} from "../server/src/dev-server-status.ts";
import {
  findAdoptableLocalService,
  removeLocalServiceRegistryRecord,
  touchLocalServiceRegistryRecord,
  writeLocalServiceRegistryRecord,
} from "../server/src/services/local-service-supervisor.ts";
import { z } from "zod";

// Keep these values local so the dev runner can boot from the server package's
// tsx context without requiring workspace package resolution first.
const BIND_MODES = ["loopback", "lan", "tailnet", "custom"] as const;
type BindMode = (typeof BIND_MODES)[number];

function parseBindMode(value: string): BindMode | null {
  const matched = BIND_MODES.find((candidate) => candidate === value);
  return matched ?? null;
}

const mode = process.argv[2] === "watch" ? "watch" : "dev";
let cliArgs: string[];
let dataDir: string | null;
try {
  const appliedOptions = applyDevRunnerOptions(process.argv.slice(3), process.env, repoRoot);
  cliArgs = appliedOptions.forwardedArgs;
  dataDir = appliedOptions.dataDir;
} catch (error) {
  console.error(`[clayon] ${errorMessage(error)}`);
  process.exit(1);
}

const worktreeEnvBootstrap = bootstrapDevRunnerWorktreeEnv(repoRoot, process.env);
if (worktreeEnvBootstrap.missingEnv) {
  console.error(
    `[clayon] linked git worktree at ${repoRoot} is missing ${path.relative(repoRoot, worktreeEnvBootstrap.envPath)}. Run \`clayon worktree init\` in this worktree before \`bun run dev\`.`,
  );
  process.exit(1);
}
if (isWorktreeSeedPending(repoRoot)) {
  console.error(
    "[clayon] this worktree database is seed-pending. Run `bun run clayon worktree ensure-seeded` before `bun run dev`.",
  );
  process.exit(1);
}

const scanIntervalMs = 1500;
const autoRestartPollIntervalMs = 2500;
const gracefulShutdownTimeoutMs = 10_000;
const changedPathSampleLimit = 5;
const devServerStatusFilePath = path.join(repoRoot, ".clayon", "dev-server-status.json");
const devServerRestartRequestFilePath = path.join(repoRoot, ".clayon", "dev-server-restart-request.json");
const devServerStatusToken = mode === "dev" ? randomUUID() : null;
const devServerStatusTokenHeader = "x-clayon-dev-server-status-token";

const watchedDirectories = [
  "cli",
  "scripts",
  "server",
  "packages/adapter-utils",
  "packages/adapters",
  "packages/db",
  "packages/skills-catalog",
  "packages/plugins/sdk",
  "packages/shared",
].map((relativePath) => path.join(repoRoot, relativePath));

const watchedFiles = [
  ".env",
  "package.json",
  "bunfig.toml",
  "tsconfig.base.json",
  "tsconfig.json",
  "vitest.config.ts",
].map((relativePath) => path.join(repoRoot, relativePath));

const ignoredDirectoryNames = new Set([
  ".git",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "ui-dist",
]);

const ignoredRelativePaths = new Set([
  ".clayon/dev-server-restart-request.json",
  ".clayon/dev-server-status.json",
]);

const tailscaleAuthFlagNames = new Set([
  "--tailscale-auth",
  "--authenticated-private",
]);

let tailscaleAuth = false;
let bindMode: BindMode | null = null;
let bindHost: string | null = null;
const managedRuntimeExposure = process.env.CLAYON_MANAGED_RUNTIME_EXPOSURE === "tailscale_https";
const forwardedArgs: string[] = [];

for (let index = 0; index < cliArgs.length; index += 1) {
  const arg = cliArgs[index];
  if (tailscaleAuthFlagNames.has(arg)) {
    tailscaleAuth = true;
    continue;
  }
  if (arg === "--bind") {
    const value = cliArgs[index + 1];
    const parsedBindMode = value === undefined ? null : parseBindMode(value);
    if (!value || value.startsWith("--") || parsedBindMode === null) {
      console.error(`[clayon] invalid --bind value. Use one of: ${BIND_MODES.join(", ")}`);
      process.exit(1);
    }
    bindMode = parsedBindMode;
    index += 1;
    continue;
  }
  if (arg === "--bind-host") {
    const value = cliArgs[index + 1];
    if (!value || value.startsWith("--")) {
      console.error("[clayon] --bind-host requires a value");
      process.exit(1);
    }
    bindHost = value;
    index += 1;
    continue;
  }
  forwardedArgs.push(arg);
}

if (process.env.npm_config_tailscale_auth === "true") {
  tailscaleAuth = true;
}
if (process.env.npm_config_authenticated_private === "true") {
  tailscaleAuth = true;
}
if (!bindMode && process.env.npm_config_bind) {
  bindMode = parseBindMode(process.env.npm_config_bind);
}
if (!bindHost && process.env.npm_config_bind_host) {
  bindHost = process.env.npm_config_bind_host;
}
if (managedRuntimeExposure) {
  bindMode = "custom";
  bindHost = "127.0.0.1";
}
if (bindMode === "custom" && !bindHost) {
  console.error("[clayon] --bind custom requires --bind-host <host>");
  process.exit(1);
}

// Managed HTTPS runtimes serve the built UI bundle: the Vite dev middleware's
// unbundled module waterfall stalls behind the Tailscale HTTPS proxy and the
// first page load in a fresh browser profile stays blank forever (PAP-18043).
const explicitUiDevMiddleware = process.env.CLAYON_UI_DEV_MIDDLEWARE;
const serveBuiltUiForManagedRuntime = managedRuntimeExposure && explicitUiDevMiddleware === undefined;
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CLAYON_UI_DEV_MIDDLEWARE: explicitUiDevMiddleware ?? (serveBuiltUiForManagedRuntime ? "false" : "true"),
};

if (mode === "dev") {
  env.CLAYON_DEV_SERVER_STATUS_FILE = devServerStatusFilePath;
  env.CLAYON_DEV_SERVER_STATUS_TOKEN = devServerStatusToken ?? "";
  env.CLAYON_MIGRATION_AUTO_APPLY ??= "true";
}

if (mode === "watch") {
  delete env.CLAYON_DEV_SERVER_STATUS_TOKEN;
  env.CLAYON_MIGRATION_PROMPT ??= "never";
  env.CLAYON_MIGRATION_AUTO_APPLY ??= "true";
}

if (tailscaleAuth || bindMode) {
  const effectiveBind = bindMode ?? "lan";
  if (tailscaleAuth) {
    console.log("[clayon] note: --tailscale-auth/--authenticated-private are legacy aliases for --bind lan");
  }
  env.CLAYON_BIND = effectiveBind;
  if (bindHost) {
    env.CLAYON_BIND_HOST = bindHost;
  } else {
    delete env.CLAYON_BIND_HOST;
  }
  if (effectiveBind === "loopback" && !tailscaleAuth) {
    delete env.CLAYON_DEPLOYMENT_MODE;
    delete env.CLAYON_DEPLOYMENT_EXPOSURE;
    delete env.CLAYON_AUTH_BASE_URL_MODE;
    console.log("[clayon] dev mode: local_trusted (bind=loopback)");
  } else {
    env.CLAYON_DEPLOYMENT_MODE = "authenticated";
    env.CLAYON_DEPLOYMENT_EXPOSURE = "private";
    env.CLAYON_AUTH_BASE_URL_MODE = managedRuntimeExposure ? "explicit" : "auto";
    console.log(
      `[clayon] dev mode: authenticated/private (bind=${effectiveBind}${bindHost ? `:${bindHost}` : ""})`,
    );
  }
} else {
  delete env.CLAYON_BIND;
  delete env.CLAYON_BIND_HOST;
  delete env.CLAYON_DEPLOYMENT_MODE;
  delete env.CLAYON_DEPLOYMENT_EXPOSURE;
  delete env.CLAYON_AUTH_BASE_URL_MODE;
  console.log("[clayon] dev mode: local_trusted (default)");
}

const serverPort = Number.parseInt(env.PORT ?? process.env.PORT ?? "3100", 10) || 3100;
const devService = createDevServiceIdentity({
  mode,
  forwardedArgs: dataDir ? [...forwardedArgs, `--data-dir=${dataDir}`] : forwardedArgs,
  networkProfile: tailscaleAuth ? `legacy:${bindMode ?? "lan"}` : (bindMode ?? "default"),
  port: serverPort,
});

const existingRunner = await findAdoptableLocalService({
  serviceKey: devService.serviceKey,
  cwd: repoRoot,
  envFingerprint: devService.envFingerprint,
  port: serverPort,
});
if (existingRunner) {
  const existingRunnerMetadata = z.object({ childPid: z.number() }).safeParse(existingRunner.metadata);
  const childSuffix = existingRunnerMetadata.success ? `, child ${existingRunnerMetadata.data.childPid}` : "";
  console.log(`[clayon] ${devService.serviceName} already running (pid ${existingRunner.pid}${childSuffix})`);
  process.exit(0);
}

const bunBin = process.platform === "win32" ? "bun.exe" : "bun";
let previousSnapshot = collectWatchedSnapshot();
let dirtyPaths = new Set<string>();
let pendingMigrations: string[] = [];
let lastChangedAt: string | null = null;
let lastRestartAt: string | null = null;
let scanInFlight = false;
let restartInFlight = false;
let shuttingDown = false;
let childExitWasExpected = false;
let child: ReturnType<typeof spawn> | null = null;
let childExitPromise: Promise<{ code: number; signal: NodeJS.Signals | null }> | null = null;
let scanTimer: ReturnType<typeof setInterval> | null = null;
let autoRestartTimer: ReturnType<typeof setInterval> | null = null;

const errorMessageShape = z.object({ message: z.string().optional() });
// The one allowed instanceof form: parse inside zod, never narrow by hand
// (moe:typescript/no-type-guards).
const errorInstanceShape = z.instanceof(Error);

// A caught error is unknown; extract its message without a type guard
// (moe:typescript/no-type-guards): parse the { message } shape, else stringify.
function errorMessage(error: unknown): string {
  const parsed = errorMessageShape.safeParse(error);
  const message = parsed.success ? parsed.data.message : undefined;
  return message ?? String(error);
}

function toError(error: unknown, context = "Dev runner command failed") {
  if (error === undefined) return new Error(context);
  // An already-Error value keeps its original identity and stack.
  const original = errorInstanceShape.safeParse(error);
  if (original.success) return original.data;
  const parsed = errorMessageShape.safeParse(error);
  const message = parsed.success ? parsed.data.message : undefined;
  if (message) return new Error(message);
  // A bare string error renders unquoted; only objects fall through to JSON.
  const asString = z.string().safeParse(error);
  if (asString.success) return new Error(`${context}: ${asString.data}`);

  try {
    return new Error(`${context}: ${JSON.stringify(error)}`);
  } catch {
    return new Error(`${context}: ${String(error)}`);
  }
}

process.on("uncaughtException", async (error) => {
  await removeLocalServiceRegistryRecord(devService.serviceKey);
  const err = toError(error, "Uncaught exception in dev runner");
  process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  await removeLocalServiceRegistryRecord(devService.serviceKey);
  const err = toError(reason, "Unhandled promise rejection in dev runner");
  process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});

function formatPendingMigrationSummary(migrations: string[]) {
  if (migrations.length === 0) return "none";
  return migrations.length > 3
    ? `${migrations.slice(0, 3).join(", ")} (+${migrations.length - 3} more)`
    : migrations.join(", ");
}

function exitForSignal(signal: NodeJS.Signals) {
  if (signal === "SIGINT") {
    process.exit(130);
  }
  if (signal === "SIGTERM") {
    process.exit(143);
  }
  process.exit(1);
}

function collectWatchedSnapshot(): Map<string, string> {
  return collectDevServerWatchedSnapshot({
    repoRoot,
    watchedDirectories,
    watchedFiles,
    ignoredDirectoryNames,
    ignoredRelativePaths,
  });
}

function ensureDevStatusDirectory() {
  mkdirSync(path.dirname(devServerStatusFilePath), { recursive: true });
}

function writeDevServerStatus() {
  if (mode !== "dev") return;

  ensureDevStatusDirectory();
  const changedPaths = [...dirtyPaths].sort();
  writeFileSync(
    devServerStatusFilePath,
    `${JSON.stringify({
      dirty: changedPaths.length > 0 || pendingMigrations.length > 0,
      lastChangedAt,
      changedPathCount: changedPaths.length,
      changedPathsSample: changedPaths.slice(0, changedPathSampleLimit),
      pendingMigrations,
      lastRestartAt,
    }, null, 2)}\n`,
    "utf8",
  );
}

function clearDevServerStatus() {
  if (mode !== "dev") return;
  rmSync(devServerStatusFilePath, { force: true });
  rmSync(devServerRestartRequestFilePath, { force: true });
}

function getDevServerRestartRequest() {
  if (mode !== "dev" || !existsSync(devServerRestartRequestFilePath)) return null;
  return readDevServerRestartRequest(env);
}

async function updateDevServiceRecord(extra?: Record<string, unknown>) {
  await writeLocalServiceRegistryRecord({
    version: 1,
    serviceKey: devService.serviceKey,
    profileKind: "clayon-dev",
    serviceName: devService.serviceName,
    command: "dev-runner.ts",
    cwd: repoRoot,
    envFingerprint: devService.envFingerprint,
    port: serverPort,
    url: `http://127.0.0.1:${serverPort}`,
    pid: process.pid,
    processGroupId: null,
    provider: "local_process",
    runtimeServiceId: null,
    reuseKey: null,
    startedAt: lastRestartAt ?? new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    metadata: {
      repoRoot,
      mode,
      childPid: child?.pid ?? null,
      url: `http://127.0.0.1:${serverPort}`,
      ...extra,
    },
  });
}

type RunBunOptions = {
  stdio?: "inherit" | ["ignore", "pipe", "pipe"];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

// Runs `bun run <args>`: package scripts, `--filter <pkg> <script>`, or
// `--cwd <dir> <bin> ...` for a binary inside a workspace package.
async function runBun(args: string[], options: RunBunOptions = {}) {
  return await new Promise<{ code: number; signal: NodeJS.Signals | null; stdout: string; stderr: string }>((resolve, reject) => {
    const spawned = spawn(bunBin, ["run", ...args], {
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      env: options.env ?? process.env,
      cwd: options.cwd,
      shell: process.platform === "win32",
    });

    const stdoutBuffer = createCapturedOutputBuffer();
    const stderrBuffer = createCapturedOutputBuffer();

    if (spawned.stdout) {
      spawned.stdout.on("data", (chunk) => {
        stdoutBuffer.append(chunk);
      });
    }
    if (spawned.stderr) {
      spawned.stderr.on("data", (chunk) => {
        stderrBuffer.append(chunk);
      });
    }

    spawned.on("error", reject);
    spawned.on("exit", (code, signal) => {
      const stdout = stdoutBuffer.finish();
      const stderr = stderrBuffer.finish();
      resolve({
        code: code ?? 0,
        signal,
        stdout: stdout.text,
        stderr: stderr.text,
      });
    });
  });
}

const migrationStatusShape = z.object({
  status: z.string().optional(),
  pendingMigrations: z.array(z.string()).optional(),
});

const devHealthPayloadShape = z.object({
  devServer: z
    .object({
      enabled: z.boolean().optional(),
      autoRestartEnabled: z.boolean().optional(),
      activeRunCount: z.number().optional(),
    })
    .optional(),
  serverInfo: z
    .object({
      processStartedAt: z.string().optional(),
    })
    .optional(),
});

type DevHealthPayload = z.infer<typeof devHealthPayloadShape>;

type MigrationStatusPayload = z.infer<typeof migrationStatusShape>;

async function getMigrationStatusPayload(): Promise<MigrationStatusPayload> {
  // Spawn from the absolute repo root: the dev runner's process cwd is
  // <repo>/server, so a relative --cwd would resolve to server/packages/db.
  const status = await runBun(
    ["--silent", "--cwd", "packages/db", "tsx", "src/migration-status.ts", "--json"],
    { env, cwd: repoRoot },
  );
  if (status.code !== 0) {
    process.stderr.write(
      status.stderr ||
        status.stdout ||
        `[clayon] Command failed with code ${status.code}: bun run --cwd packages/db tsx src/migration-status.ts --json\n`,
    );
    process.exit(status.code);
  }

  // The package manager can interleave its own reporter lines (e.g. engine
  // warnings) into stdout, so parse the last line that is a JSON object
  // instead of trusting the whole stream.
  const jsonLines = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"));
  for (let index = jsonLines.length - 1; index >= 0; index -= 1) {
    try {
      const payload = migrationStatusShape.parse(JSON.parse(jsonLines[index]));
      return payload;
    } catch {
      // keep scanning earlier JSON-looking lines
    }
  }
  process.stderr.write(
    status.stderr ||
      status.stdout ||
      "[clayon] migration-status returned invalid JSON payload\n",
  );
  throw new Error("Unable to parse migration-status JSON output");
}

async function refreshPendingMigrations() {
  const payload = await getMigrationStatusPayload();
  pendingMigrations =
    payload.status === "needsMigrations"
      ? (payload.pendingMigrations?.filter((entry) => entry.trim().length > 0) ?? [])
      : [];
  writeDevServerStatus();
  return payload;
}

type MigrationPreflightOptions = {
  interactive?: boolean;
  autoApply?: boolean;
  exitOnDecline?: boolean;
};

async function maybePreflightMigrations(options: MigrationPreflightOptions = {}) {
  const interactive = options.interactive ?? mode === "watch";
  const autoApply = options.autoApply ?? env.CLAYON_MIGRATION_AUTO_APPLY === "true";
  const exitOnDecline = options.exitOnDecline ?? mode === "watch";

  const payload = await refreshPendingMigrations();
  if (payload.status !== "needsMigrations" || pendingMigrations.length === 0) {
    return;
  }

  let shouldApply = autoApply;

  if (!autoApply && interactive) {
    if (!stdin.isTTY || !stdout.isTTY) {
      shouldApply = true;
    } else {
      const prompt = createInterface({ input: stdin, output: stdout });
      try {
        const answer = (
          await prompt.question(
            `Apply pending migrations (${formatPendingMigrationSummary(pendingMigrations)}) now? (y/N): `,
          )
        )
          .trim()
          .toLowerCase();
        shouldApply = answer === "y" || answer === "yes";
      } finally {
        prompt.close();
      }
    }
  }

  if (!shouldApply) {
    if (exitOnDecline) {
      process.stderr.write(
        `[clayon] Pending migrations detected (${formatPendingMigrationSummary(pendingMigrations)}). Refusing to start watch mode against a stale schema.\n`,
      );
      process.exit(1);
    }
    return;
  }

  const exit = await runBun(["db:migrate"], {
    stdio: "inherit",
    env,
    cwd: repoRoot,
  });
  if (exit.signal) {
    exitForSignal(exit.signal);
    return;
  }
  if (exit.code !== 0) {
    process.exit(exit.code);
  }

  await refreshPendingMigrations();
}

async function buildPluginSdk() {
  console.log("[clayon] building plugin sdk...");
  const result = await runBun(
    ["--filter", "@clayon/plugin-sdk", "build"],
    { stdio: "inherit" },
  );
  if (result.signal) {
    exitForSignal(result.signal);
    return;
  }
  if (result.code !== 0) {
    console.error("[clayon] plugin sdk build failed");
    process.exit(result.code);
  }
}

async function getNativeRunnerRequired(): Promise<boolean> {
  // Spawn from the absolute repo root: the dev runner's process cwd is
  // <repo>/server, so a relative --cwd would resolve to server/server.
  const status = await runBun(
    [
      "--silent",
      "--cwd",
      "server",
      "tsx",
      "src/dev-native-runner-status.ts",
    ],
    { env, cwd: repoRoot },
  );
  if (status.signal) {
    exitForSignal(status.signal);
    return true;
  }
  const requirement = resolveNativeRunnerRequirement({
    exitCode: status.code,
    stdout: status.stdout,
  });
  if (!requirement.valid) {
    const detail = status.stderr || status.stdout;
    process.stderr.write(
      `[clayon] unable to determine the native runner requirement; conservatively preparing the native runner${detail ? `\n${detail}` : "\n"}`,
    );
  }
  return requirement.nativeRunnerRequired;
}

async function buildClayonRunner() {
  console.log("[clayon] building clayon runner...");
  const typescriptResult = await runBun(
    ["--filter", "@clayon/clayon-runner", "build:typescript"],
    { stdio: "inherit" },
  );
  if (typescriptResult.signal) {
    exitForSignal(typescriptResult.signal);
    return;
  }
  if (typescriptResult.code !== 0) {
    console.error("[clayon] clayon runner build failed");
    process.exit(typescriptResult.code);
  }

  if (
    !clayonRunnerBinaryNeedsBuild({
      repoRoot,
      nativeRunnerRequired: await getNativeRunnerRequired(),
      configuredBinary: env.CLAYON_RUNNER_BINARY,
    })
  ) {
    return;
  }

  console.log("[clayon] building clayon runner native binary...");
  const binaryResult = await runBun(
    ["--filter", "@clayon/clayon-runner", "build:binary"],
    { stdio: "inherit" },
  );
  if (binaryResult.signal) {
    exitForSignal(binaryResult.signal);
    return;
  }
  if (binaryResult.code !== 0) {
    console.error("[clayon] clayon runner native binary build failed");
    process.exit(binaryResult.code);
  }
}

function newestMtimeMs(target: string): number {
  const stat = statSync(target, { throwIfNoEntry: false });
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(target)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const childNewest = newestMtimeMs(path.join(target, entry));
    if (childNewest > newest) newest = childNewest;
  }
  return newest;
}

function uiBundleIsFresh(): boolean {
  const distIndex = path.join(repoRoot, "ui", "dist", "index.html");
  const distStat = statSync(distIndex, { throwIfNoEntry: false });
  if (!distStat) return false;
  const sources = [
    path.join(repoRoot, "ui", "src"),
    path.join(repoRoot, "ui", "public"),
    path.join(repoRoot, "ui", "index.html"),
    path.join(repoRoot, "ui", "package.json"),
    path.join(repoRoot, "ui", "vite.config.ts"),
    path.join(repoRoot, "packages", "shared", "src"),
  ];
  return sources.every((source) => newestMtimeMs(source) <= distStat.mtimeMs);
}

async function buildUiBundleForManagedRuntime(): Promise<boolean> {
  console.log("[clayon] managed runtime: building the UI bundle for static serving...");
  const result = await runBun(
    ["--filter", "@clayon/ui", "build"],
    { stdio: "inherit" },
  );
  if (result.signal) {
    exitForSignal(result.signal);
    return false;
  }
  if (result.code !== 0) {
    console.error(
      "[clayon] UI bundle build failed; falling back to the Vite dev middleware (the page may load slowly or stay blank over HTTPS)",
    );
    return false;
  }
  return true;
}

async function markChildAsCurrent() {
  previousSnapshot = collectWatchedSnapshot();
  dirtyPaths = new Set();
  lastChangedAt = null;
  lastRestartAt = new Date().toISOString();
  await refreshPendingMigrations();
  await updateDevServiceRecord();
}

async function scanForBackendChanges() {
  if (mode !== "dev" || scanInFlight || restartInFlight) return;
  scanInFlight = true;
  try {
    const nextSnapshot = collectWatchedSnapshot();
    const changed = diffSnapshots(previousSnapshot, nextSnapshot);
    previousSnapshot = nextSnapshot;
    if (changed.length === 0) return;

    for (const relativePath of changed) {
      dirtyPaths.add(relativePath);
    }
    lastChangedAt = new Date().toISOString();
    await refreshPendingMigrations();
  } finally {
    scanInFlight = false;
  }
}

async function getDevHealthPayload(): Promise<DevHealthPayload> {
  const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`, {
    headers: devServerStatusToken ? { [devServerStatusTokenHeader]: devServerStatusToken } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Health request failed (${response.status})`);
  }
  return devHealthPayloadShape.parse(await parseJsonResponseWithLimit(response));
}

async function waitForChildExit() {
  if (!childExitPromise) {
    return { code: 0, signal: null };
  }
  return await childExitPromise;
}

async function stopChildForRestart() {
  if (!child) return { code: 0, signal: null };
  childExitWasExpected = true;
  child.kill("SIGTERM");
  const killTimer = setTimeout(() => {
    if (child) {
      child.kill("SIGKILL");
    }
  }, gracefulShutdownTimeoutMs);
  try {
    return await waitForChildExit();
  } finally {
    clearTimeout(killTimer);
  }
}

async function startServerChild() {
  await buildClayonRunner();
  await buildPluginSdk();

  const serverScript = mode === "watch" ? "dev:watch" : "dev";
  child = spawn(
    bunBin,
    ["run", "--filter", "@clayon/server", serverScript, ...forwardedArgs],
    { stdio: "inherit", env, shell: process.platform === "win32" },
  );

  childExitPromise = new Promise((resolve, reject) => {
    child?.on("error", reject);
    child?.on("exit", (code, signal) => {
      const expected = childExitWasExpected;
      childExitWasExpected = false;
      child = null;
      childExitPromise = null;
      void touchLocalServiceRegistryRecord(devService.serviceKey, {
        metadata: {
          repoRoot,
          mode,
          childPid: null,
          url: `http://127.0.0.1:${serverPort}`,
        },
      });
      resolve({ code: code ?? 0, signal });

      if (restartInFlight || expected || shuttingDown) {
        return;
      }
      if (signal) {
        exitForSignal(signal);
        return;
      }
      process.exit(code ?? 0);
    });
  });

  await markChildAsCurrent();
}

async function maybeAutoRestartChild() {
  if (mode !== "dev" || restartInFlight || !child) return;
  const manualRestartRequest = getDevServerRestartRequest();
  if (!manualRestartRequest && dirtyPaths.size === 0 && pendingMigrations.length === 0) return;

  restartInFlight = true;
  let health: DevHealthPayload | null = null;
  try {
    health = await getDevHealthPayload();
  } catch {
    restartInFlight = false;
    return;
  }

  const devServer = health?.devServer;
  if (!devServer?.enabled) {
    restartInFlight = false;
    return;
  }
  const observedServerIdentity = health?.serverInfo?.processStartedAt ?? null;
  if (
    manualRestartRequest?.previousServerIdentity &&
    observedServerIdentity !== manualRestartRequest.previousServerIdentity
  ) {
    removeDevServerRestartRequest(
      manualRestartRequest.requestId
        ? { requestId: manualRestartRequest.requestId }
        : undefined,
      env,
    );
    restartInFlight = false;
    return;
  }
  if (!manualRestartRequest && devServer.autoRestartEnabled !== true) {
    restartInFlight = false;
    return;
  }
  if (!manualRestartRequest && (devServer.activeRunCount ?? 0) > 0) {
    restartInFlight = false;
    return;
  }

  try {
    await maybePreflightMigrations({
      autoApply: true,
      interactive: false,
      exitOnDecline: false,
    });
    await stopChildForRestart();
    const restartRequestConsumed = manualRestartRequest
      ? removeDevServerRestartRequest(
        manualRestartRequest.requestId
          ? { requestId: manualRestartRequest.requestId }
          : undefined,
        env,
      )
      : true;
    await startServerChild();
    if (manualRestartRequest && !restartRequestConsumed) {
      // A live writer may briefly hold the request lock. Starting the child is
      // still correct because the requested restart already happened; retry
      // correlated cleanup afterward without terminating the supervisor.
      removeDevServerRestartRequest(
        manualRestartRequest.requestId
          ? { requestId: manualRestartRequest.requestId }
          : undefined,
        env,
      );
    }
  } catch (error) {
    const err = toError(error, "Auto-restart failed");
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(1);
  } finally {
    restartInFlight = false;
  }
}

function installDevIntervals() {
  if (mode !== "dev") return;

  scanTimer = setInterval(() => {
    void scanForBackendChanges();
  }, scanIntervalMs);
  autoRestartTimer = setInterval(() => {
    void maybeAutoRestartChild();
  }, autoRestartPollIntervalMs);
}

function clearDevIntervals() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (autoRestartTimer) {
    clearInterval(autoRestartTimer);
    autoRestartTimer = null;
  }
}

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearDevIntervals();
  clearDevServerStatus();
  await removeLocalServiceRegistryRecord(devService.serviceKey);

  if (!child) {
    exitForSignal(signal);
    return;
  }

  childExitWasExpected = true;
  child.kill(signal);
  const exit = await waitForChildExit();
  if (exit.signal) {
    exitForSignal(exit.signal);
    return;
  }
  process.exit(exit.code ?? 0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// The managed runtime readiness window is tight, so reuse a fresh bundle
// when possible and overlap a needed rebuild with the migration preflight.
let uiBundleBuild: Promise<boolean> | null = null;
if (serveBuiltUiForManagedRuntime) {
  if (uiBundleIsFresh()) {
    console.log("[clayon] managed runtime: reusing the up-to-date UI bundle in ui/dist");
  } else {
    uiBundleBuild = buildUiBundleForManagedRuntime();
  }
}
await maybePreflightMigrations();
if (uiBundleBuild) {
  env.CLAYON_UI_DEV_MIDDLEWARE = (await uiBundleBuild) ? "false" : "true";
}
await startServerChild();
installDevIntervals();

if (mode === "watch") {
  const exit = await waitForChildExit();
  await removeLocalServiceRegistryRecord(devService.serviceKey);
  if (exit.signal) {
    exitForSignal(exit.signal);
  }
  process.exit(exit.code ?? 0);
}
