import os from "node:os";
import path from "node:path";

export const DEFAULT_CLAYON_INSTANCE_ID = "default";
export const CLAYON_CONFIG_BASENAME = "config.json";
export const CLAYON_ENV_FILENAME = ".env";

const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveClayonHomeDir(homeOverride?: string): string {
  const raw = homeOverride?.trim() || process.env.CLAYON_HOME?.trim();
  if (raw) return path.resolve(expandHomePrefix(raw));
  return path.resolve(os.homedir(), ".clayon");
}

export function resolveClayonInstanceId(instanceIdOverride?: string): string {
  const raw = instanceIdOverride?.trim() || process.env.CLAYON_INSTANCE_ID?.trim() || DEFAULT_CLAYON_INSTANCE_ID;
  if (!PATH_SEGMENT_RE.test(raw)) {
    throw new Error(`Invalid CLAYON_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolveClayonInstanceRoot(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonHomeDir(input.homeDir), "instances", resolveClayonInstanceId(input.instanceId));
}

export function resolveClayonInstanceConfigPath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonInstanceRoot(input), CLAYON_CONFIG_BASENAME);
}

export function resolveClayonConfigPathForInstance(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return resolveClayonInstanceConfigPath(input);
}

export function resolveClayonEnvPathForConfig(configPath: string): string {
  return path.resolve(path.dirname(configPath), CLAYON_ENV_FILENAME);
}

export function resolveDefaultEmbeddedPostgresDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonInstanceRoot(input), "db");
}

export function resolveDefaultLogsDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonInstanceRoot(input), "logs");
}

export function resolveDefaultSecretsKeyFilePath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonInstanceRoot(input), "secrets", "master.key");
}

export function resolveDefaultStorageDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonInstanceRoot(input), "data", "storage");
}

export function resolveDefaultBackupDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveClayonInstanceRoot(input), "data", "backups");
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}
