/** Names minted by the controller from the resolved task configuration.
 * Values remain in the process environment, never in argv or this manifest.
 * Do not mint this projection from ambient process.env.
 */
export const CONFIGURED_ENVIRONMENT_KEYS = "CLAYON_CONFIGURED_ENV_KEYS";

export const GENERATED_RUNTIME_ENVIRONMENT_KEYS: ReadonlySet<string> = new Set([
  CONFIGURED_ENVIRONMENT_KEYS,
  "CLAYON_AGENT_ID", "CLAYON_AGENT_KEY_ID", "CLAYON_AGENT_PUBLIC_KEY", "CLAYON_AGENT_PRIVATE_KEY",
  "CLAYON_API_KEY", "CLAYON_API_URL", "CLAYON_API_BRIDGE_MODE", "CLAYON_COMPANY_ID", "CLAYON_INSTANCE_ID",
  "CLAYON_RUN_ID", "CLAYON_NORMALIZED_SESSION_ID", "CLAYON_RUNNER_INSTANCE_ID", "CLAYON_RUNNER_BOOTSTRAP_TICKET", "CLAYON_TASK_ID", "CLAYON_APPROVAL_ID", "CLAYON_APPROVAL_STATUS", "CLAYON_LINKED_ISSUE_IDS",
  "CLAYON_WAKE_REASON", "CLAYON_WAKE_COMMENT_ID", "CLAYON_WAKE_PAYLOAD_JSON", "CLAYON_EXECUTION_MODE",
  "CLAYON_WORKSPACES_JSON", "CLAYON_WORKSPACE_ID", "CLAYON_WORKSPACE_CWD", "CLAYON_WORKSPACE_SOURCE",
  "CLAYON_WORKSPACE_REPO_URL", "CLAYON_WORKSPACE_REPO_REF", "CLAYON_WORKSPACE_BRANCH",
  "CLAYON_WORKSPACE_WORKTREE_PATH", "CLAYON_WORKSPACE_REALIZATION_MODE", "CLAYON_WORKSPACE_AUTHORITATIVE_ROOT",
  "CLAYON_RUNTIME_PRIMARY_URL", "CLAYON_RUNTIME_SERVICES_JSON", "CLAYON_RUNTIME_SERVICE_INTENTS_JSON",
  "CLAYON_AGENT_MESSAGE_KEY", "CLAYON_HARNESS_CHECKOUT_KEY", "CLAYON_EXTERNAL_CHAT_EXECUTION_BOUND_KEY",
  "CLAYON_NATIVE_MCP_NAME", "CLAYON_NATIVE_MCP_URL", "CLAYON_NATIVE_MCP_TOKEN", "CLAYON_AI_PROVIDER_KEY",
  "CLAYON_PROVIDER_TRACE_PATH", "CLAYON_PROVIDER_TRACE_MAX_BYTES", "CLAYON_ACPX_CREDENTIAL_BINDING",
  "CLAYON_RUNNER_NETWORK_ACCESS", "CLAYON_RUNNER_NETWORK_ROOTS", "CLAYON_RUNNER_EXTERNAL_SANDBOX",
  "CLAYON_GITHUB_AUTH_MODE", "CLAYON_GITHUB_HOST_HOME", "CLAYON_GIT_METADATA_ROOTS",
  "CLAYON_GITHUB_BROKER_TOKEN", "CLAYON_GITHUB_BROKER_URL", "CLAYON_GITHUB_BRIDGE_TOKEN", "CLAYON_GITHUB_LAUNCHER_DIR",
]);

const RESERVED_KEYS = new Set([
  "PATH", "HOME", "USERPROFILE", "CODEX_HOME", "AGENT_HOME", "SHELL", "NODE_OPTIONS", "NODE_PATH",
  "PYTHONPATH", "PYTHONHOME", "RUBYOPT", "RUBYLIB", "PERL5OPT", "PERL5LIB", "BASH_ENV", "ENV",
  "OPENAI_API_KEY", "CODEX_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK", "OPENROUTER_API_KEY", "XAI_API_KEY", "CURSOR_API_KEY", "CURSOR_AUTH_TOKEN",
  "COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN", "CLAYON_GIT_TOKEN",
]);

function eligibleKey(key: string): boolean {
  const upper = key.toUpperCase();
  return /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)
    && !GENERATED_RUNTIME_ENVIRONMENT_KEYS.has(upper)
    && !RESERVED_KEYS.has(upper)
    && !/^(?:LD_|DYLD_|GIT_CONFIG_|CLAYON_(?:RUNNER_|NATIVE_|GITHUB_|ACPX_|VERIFIED_))/.test(upper);
}

function checkedNames(names: unknown): string[] {
  if (!Array.isArray(names) || names.length > 128 || names.some(name => typeof name !== "string" || !eligibleKey(name))
    || new Set(names).size !== names.length) throw new Error("Invalid configured environment projection");
  return (names as string[]).sort();
}

/** Mint at the server's resolved configuration boundary, before host inheritance. */
export function configuredEnvironmentProjection(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const names = checkedNames(Object.keys(source).filter(key => source[key] !== undefined && eligibleKey(key)));
  return configuredEnvironment({ ...source, [CONFIGURED_ENVIRONMENT_KEYS]: JSON.stringify(names) });
}

/** Accept only an explicitly supplied, controller-minted projection. */
export function configuredEnvironment(source: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const raw = source?.[CONFIGURED_ENVIRONMENT_KEYS];
  if (raw === undefined) return {};
  if (Buffer.byteLength(raw) > 20_000) throw new Error("Invalid configured environment projection");
  let names: string[];
  try { names = checkedNames(JSON.parse(raw)); } catch { throw new Error("Invalid configured environment projection"); }
  const result: NodeJS.ProcessEnv = {};
  let bytes = 0;
  for (const name of names) {
    const value = source?.[name];
    if (typeof value !== "string" || value.includes("\0")) throw new Error("Invalid configured environment value");
    const size = Buffer.byteLength(name) + Buffer.byteLength(value);
    bytes += size;
    if (size > 65_536 || bytes > 262_144) throw new Error("Configured environment exceeds its bounded launch size");
    result[name] = value;
  }
  result[CONFIGURED_ENVIRONMENT_KEYS] = JSON.stringify(names);
  return result;
}

export function configuredEnvironmentKeys(source: NodeJS.ProcessEnv | undefined): string[] {
  return Object.keys(configuredEnvironment(source)).filter(key => key !== CONFIGURED_ENVIRONMENT_KEYS).sort();
}
