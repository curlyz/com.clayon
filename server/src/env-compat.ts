/**
 * CLAYON_ env rename (rebrand wave A), backward compatible.
 *
 * The server's env vocabulary moves from the CLAYON_ prefix to CLAYON_.
 * Rather than teaching 80+ read sites to try both names, this module
 * normalizes once at startup: every CLAYON_X becomes readable as
 * CLAYON_X, with the CLAYON_ value preferred when both are set.
 * Reads keep working through either name, so deployments (and the .env
 * files, compose stacks, and child processes that spell the legacy name)
 * keep working unchanged this wave.
 *
 * This file is imported FIRST by the server entrypoint (before config.js
 * and its transitive paths.js, which read CLAYON_CONFIG at module
 * init), and config.ts applies the pass again after dotenv loads the
 * instance .env file.
 */

const CLAYON_PREFIX = "CLAYON_";
const LEGACY_PREFIX = "CLAYON_";

/**
 * Copies every non-empty CLAYON_X over its CLAYON_X equivalent in `env`.
 * A CLAYON_ value always wins over a legacy value ("prefer new"); an empty
 * CLAYON_ value is treated as unset so the legacy value survives. Returns
 * the legacy keys that were written, for logging and tests.
 */
export function applyClayonEnvCompat(env: NodeJS.ProcessEnv = process.env): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(CLAYON_PREFIX)) continue;
    if (value === undefined || value === "") continue;
    const legacyKey = LEGACY_PREFIX + key.slice(CLAYON_PREFIX.length);
    if (env[legacyKey] === value) continue;
    env[legacyKey] = value;
    applied.push(legacyKey);
  }
  return applied;
}

/**
 * Reads one variable preferring the CLAYON_ spelling: `readClayonEnv("CLAYON_X")`
 * returns CLAYON_X when set (non-empty), else CLAYON_X. For readers that
 * take an explicit env object (tests, child-process builders) where the
 * startup normalization has not run.
 */
export function readClayonEnv(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (name.startsWith(LEGACY_PREFIX)) {
    const clayonKey = CLAYON_PREFIX + name.slice(LEGACY_PREFIX.length);
    const clayonValue = env[clayonKey];
    if (clayonValue !== undefined && clayonValue !== "") return clayonValue;
  }
  return env[name];
}

// Normalize the real process environment at import time. Import order is the
// contract: this module must be the server entrypoint's first import so the
// compat pass runs before any module-level CLAYON_ read.
applyClayonEnvCompat();
