import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The sole allowed simulator for this app (workspace law): Paperclip —
// iPhone 17. Never point this app at another brand's simulator.
const SIMULATOR_ID = "D19907FE-5D32-4548-91E3-66DF7DBDF44B";
// Curlyz's iPhone (same UDID `cap run ios --list` reports). The dedicated
// ios:device script passes --device; a flag on the simulator path was
// previously silently ignored by `cap run --target`, so keep the paths
// separate and explicit.
const DEVICE_ID = "00008020-000B04381481002E";
const port = 20010;

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const device = process.argv.includes("--device");
const runTarget = device ? DEVICE_ID : SIMULATOR_ID;
let host = process.env.CAP_DEV_HOST || (device ? "" : "127.0.0.1");
if (!host) {
  for (const name of ["en0", "en1"]) {
    try {
      host = execFileSync("ipconfig", ["getifaddr", name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {}
    if (host) break;
  }
}
if (!host) throw new Error("No LAN address found. Join the phone's Wi-Fi or set CAP_DEV_HOST.");

if (!existsSync(join(appRoot, "dist/index.html"))) {
  console.log("Creating the first static bundle before native sync…");
  execFileSync("pnpm", ["run", "ios:sync"], { cwd: appRoot, stdio: "inherit" });
}

let stopping = false;
/** @type {import("node:child_process").ChildProcess | undefined} */
let native;
/** @type {import("node:child_process").ChildProcess | undefined} */
let dev;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of [native, dev]) {
    if (!child?.pid) continue;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  process.exit(code);
}
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

dev = spawn("vite", ["dev", "--port", String(port)], {
  cwd: appRoot,
  /*
   * The shell's WebView always talks to the deployed instance (cross-origin,
   * credentialed): the local loopback dev server only serves the web bundle,
   * and the instance allowlists the shell origin for exactly this loop.
   */
  env: { ...process.env, VITE_PAPERCLIP_API_ORIGIN: "https://paperclip.curly.ng" },
  stdio: "inherit",
  detached: true,
});
dev.on("error", (error) => {
  console.error(error.message);
  stop(1);
});
dev.on("exit", (code) => {
  if (!stopping) stop(code || 1);
});

const deadline = Date.now() + 120_000;
let ready = false;
while (!ready && Date.now() < deadline) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2000) });
    ready = response.ok;
    await response.body?.cancel();
  } catch {}
  if (!ready) await new Promise((resolve) => setTimeout(resolve, 300));
}
if (!ready) {
  console.error(`Vite did not become ready on port ${port}. Check the server output above.`);
  stop(1);
}

console.log(`\nNative live reload: http://${host}:${port}\n`);
native = spawn(
  "cap",
  ["run", "ios", "--target", runTarget, "--live-reload", "--host", host, "--port", String(port)],
  {
    cwd: appRoot,
    stdio: "inherit",
    detached: true,
  },
);
native.on("error", (error) => {
  console.error(error.message);
  stop(1);
});
native.on("exit", (code, signal) => {
  if (stopping) return;
  if (code === 0 && !signal)
    console.log("App deployed. Vite stays running for live reload. Press Ctrl+C to stop.");
  else stop(code || 1);
});
