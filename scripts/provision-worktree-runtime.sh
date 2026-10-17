#!/usr/bin/env bash
# Keep this script compatible with macOS's system Bash 3.2.
set -euo pipefail

base_cwd="${CLAYON_WORKSPACE_BASE_CWD:?CLAYON_WORKSPACE_BASE_CWD is required}"
worktree_cwd="${CLAYON_WORKSPACE_CWD:?CLAYON_WORKSPACE_CWD is required}"
clayon_home="${CLAYON_HOME:-$HOME/.clayon}"
clayon_instance_id="${CLAYON_INSTANCE_ID:-default}"
clayon_dir="$worktree_cwd/.clayon"
worktree_config_path="$clayon_dir/config.json"
seed_manifest_path="$clayon_dir/seed-manifest.json"
seed_empty_path="$clayon_dir/seed-empty"

if [[ ! -d "$base_cwd" ]]; then
  echo "Base workspace does not exist: $base_cwd" >&2
  exit 1
fi

if [[ ! -d "$worktree_cwd" ]]; then
  echo "Derived worktree does not exist: $worktree_cwd" >&2
  exit 1
fi

if [[ -e "$seed_empty_path" ]]; then
  echo "Worktree instance is explicitly empty; automatic database copying is disabled." >&2
  exit 0
fi

if [[ -e "$seed_manifest_path" ]]; then
  seed_manifest_state="$(SEED_MANIFEST_PATH="$seed_manifest_path" node <<'EOF'
const fs = require("node:fs");
try {
  const value = JSON.parse(fs.readFileSync(process.env.SEED_MANIFEST_PATH, "utf8"));
  const complete = value?.version === 2
    && value?.state === "verified"
    && value?.phase === "complete"
    && typeof value?.source?.instanceId === "string" && value.source.instanceId.length > 0
    && typeof value?.source?.configPath === "string" && value.source.configPath.length > 0
    && (value?.seedMode === "minimal" || value?.seedMode === "full")
    && typeof value?.snapshotAt === "string" && value.snapshotAt.length > 0
    && typeof value?.migrationRevision === "string" && value.migrationRevision.length > 0
    && typeof value?.targetInstanceId === "string" && value.targetInstanceId.length > 0
    && typeof value?.attemptId === "string" && value.attemptId.length > 0
    && typeof value?.startedAt === "string"
    && typeof value?.finishedAt === "string"
    && Array.isArray(value?.diagnostics)
    && value.diagnostics.some((entry) => entry?.phase === "complete" && entry?.status === "succeeded" && typeof entry?.at === "string");
  process.stdout.write(complete ? "verified" : "incomplete");
} catch {
  process.stdout.write("invalid");
}
EOF
)"
  if [[ "$seed_manifest_state" == "verified" ]]; then
    echo "Worktree database has a verified seed manifest; skipping runtime provisioning." >&2
    exit 0
  fi
fi

if [[ ! -f "$worktree_config_path" ]]; then
  initial_provision_script="$base_cwd/scripts/provision-worktree.sh"
  if [[ ! -f "$initial_provision_script" ]]; then
    echo "Worktree config does not exist and the built-in provision script is unavailable: $worktree_config_path" >&2
    exit 1
  fi
  echo "Worktree config is missing; running the built-in worktree provisioner before database seeding." >&2
  (
    cd "$worktree_cwd" &&
      bash "$initial_provision_script"
  )
fi

if [[ ! -f "$worktree_config_path" ]]; then
  echo "Worktree config still does not exist after built-in provisioning: $worktree_config_path" >&2
  exit 1
fi

# The CLI derives the source from CLAYON_WORKSPACE_BASE_CWD, which the control
# plane injects from the registered project-workspace row. A base workspace that is
# a plain checkout carries no instance config of its own, so name the control plane's
# own registered instance config explicitly. The seed manifest stays diagnostic
# evidence only and must never choose the clone source.
if [[ -L "$base_cwd/.clayon" && ! -d "$base_cwd/.clayon" ]]; then
  echo "Registered base project workspace .clayon is a broken symlink: $base_cwd/.clayon" >&2
  exit 1
fi
source_config_args=()
if [[ ! -e "$base_cwd/.clayon/config.json" && ! -L "$base_cwd/.clayon/config.json" ]]; then
  source_config_path="${CLAYON_CONFIG:-$clayon_home/instances/$clayon_instance_id/config.json}"
  # A human may invoke this after sourcing `worktree env`, which points
  # CLAYON_CONFIG at the target. Naming the target as its own source is never
  # right, so leave the source to the CLI in that case.
  if [[ "$source_config_path" != "$worktree_config_path" ]]; then
    source_config_args=(--from-config "$source_config_path")
  fi
fi

base_cli_runner_path="$base_cwd/cli/node_modules/tsx/dist/cli.mjs"
base_cli_entry_path="$base_cwd/cli/src/index.ts"

base_cli_files_present() {
  [[ -f "$base_cli_runner_path" && -f "$base_cli_entry_path" ]]
}

base_cli_healthy() {
  base_cli_files_present || return 1
  (cd "$base_cwd" && node "$base_cli_runner_path" "$base_cli_entry_path" --help >/dev/null 2>&1)
}

repair_base_workspace_install() {
  command -v bun >/dev/null 2>&1 || return 1
  [[ -f "$base_cwd/package.json" && -f "$base_cwd/bun.lock" ]] || return 1
  echo "Base workspace CLI at $base_cli_entry_path failed its health check (typically dangling symlinks after a partial install); repairing with bun install in $base_cwd." >&2
  local repair_cmd=(bun install --force --frozen-lockfile)
  local repair_lock_dir=""
  if command -v git >/dev/null 2>&1; then
    repair_lock_dir="$(git -C "$base_cwd" rev-parse --absolute-git-dir 2>/dev/null || true)"
  fi
  if [[ ! -d "$repair_lock_dir" && -d "$base_cwd/.git" ]]; then
    repair_lock_dir="$base_cwd/.git"
  fi
  if command -v flock >/dev/null 2>&1 && [[ -d "$repair_lock_dir" ]]; then
    (
      cd "$base_cwd" || exit 1
      exec 9>"$repair_lock_dir/clayon-provision-repair.lock"
      flock 9
      if base_cli_healthy; then
        echo "Base workspace CLI became healthy while waiting for the repair lock; skipping reinstall." >&2
        exit 0
      fi
      env -u NODE_ENV CI=true "${repair_cmd[@]}" >&2 || exit 1
      base_cli_healthy
    )
  else
    (cd "$base_cwd" && env -u NODE_ENV CI=true "${repair_cmd[@]}" >&2 && base_cli_healthy)
  fi
}

ensure_base_cli_healthy() {
  base_cli_files_present || return 1
  base_cli_healthy && return 0
  repair_base_workspace_install
}

run_ensure_seeded() {
  if ensure_base_cli_healthy; then
    (
      cd "$worktree_cwd" &&
        node "$base_cli_runner_path" "$base_cli_entry_path" worktree ensure-seeded --config "$worktree_config_path" ${source_config_args[@]+"${source_config_args[@]}"}
    )
    return
  fi

  if command -v bun >/dev/null 2>&1 && bun run clayon --help >/dev/null 2>&1; then
    (
      cd "$worktree_cwd" &&
        bun run clayon worktree ensure-seeded --config "$worktree_config_path" ${source_config_args[@]+"${source_config_args[@]}"}
    )
    return
  fi

  if command -v clayon >/dev/null 2>&1; then
    (
      cd "$worktree_cwd" &&
        clayon worktree ensure-seeded --config "$worktree_config_path" ${source_config_args[@]+"${source_config_args[@]}"}
    )
    return
  fi

  return 127
}

if run_ensure_seeded; then
  exit 0
else
  exit_code=$?
  if [[ "$exit_code" -eq 127 ]]; then
    echo "No usable clayon CLI found; cannot seed the worktree database." >&2
  fi
  exit "$exit_code"
fi
