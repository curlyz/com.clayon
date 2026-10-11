import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@clayon/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createClayonRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"clayon"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const clayonKey = "clayon/clayon/clayon";
  const createAgentKey = "clayon/clayon/clayon-create-agent";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("repairs a Codex Clayon skill symlink that still points at another live checkout", async () => {
    const currentRepo = await makeTempDir("clayon-codex-current-");
    const oldRepo = await makeTempDir("clayon-codex-old-");
    const skillsHome = await makeTempDir("clayon-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createClayonRepoSkill(currentRepo, "clayon");
    await createClayonRepoSkill(currentRepo, "clayon-create-agent");
    await createClayonRepoSkill(oldRepo, "clayon");
    await fs.symlink(path.join(oldRepo, "skills", "clayon"), path.join(skillsHome, "clayon"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [
          {
            key: clayonKey,
            runtimeName: "clayon",
            source: path.join(currentRepo, "skills", "clayon"),
          },
          {
            key: createAgentKey,
            runtimeName: "clayon-create-agent",
            source: path.join(currentRepo, "skills", "clayon-create-agent"),
          },
        ],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "clayon"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "clayon")),
    );
    expect(await fs.realpath(path.join(skillsHome, "clayon-create-agent"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "clayon-create-agent")),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Repaired Codex skill "clayon"'),
      }),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Injected Codex skill "clayon-create-agent"'),
      }),
    );
  });

  it("preserves a custom Codex skill symlink outside Clayon repo checkouts", async () => {
    const currentRepo = await makeTempDir("clayon-codex-current-");
    const customRoot = await makeTempDir("clayon-codex-custom-");
    const skillsHome = await makeTempDir("clayon-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createClayonRepoSkill(currentRepo, "clayon");
    await createCustomSkill(customRoot, "clayon");
    await fs.symlink(path.join(customRoot, "custom", "clayon"), path.join(skillsHome, "clayon"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: clayonKey,
        runtimeName: "clayon",
        source: path.join(currentRepo, "skills", "clayon"),
      }],
    });

    expect(await fs.realpath(path.join(skillsHome, "clayon"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "clayon")),
    );
  });

  it("prunes broken symlinks for unavailable Clayon repo skills before Codex starts", async () => {
    const currentRepo = await makeTempDir("clayon-codex-current-");
    const oldRepo = await makeTempDir("clayon-codex-old-");
    const skillsHome = await makeTempDir("clayon-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createClayonRepoSkill(currentRepo, "clayon");
    await createClayonRepoSkill(oldRepo, "agent-browser");
    const staleTarget = path.join(oldRepo, "skills", "agent-browser");
    await fs.symlink(staleTarget, path.join(skillsHome, "agent-browser"));
    await fs.rm(staleTarget, { recursive: true, force: true });

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: clayonKey,
          runtimeName: "clayon",
          source: path.join(currentRepo, "skills", "clayon"),
        }],
      },
    );

    await expect(fs.lstat(path.join(skillsHome, "agent-browser"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Removed stale Codex skill "agent-browser"'),
      }),
    );
  });

  it("preserves other live Clayon skill symlinks in the shared workspace skill directory", async () => {
    const currentRepo = await makeTempDir("clayon-codex-current-");
    const skillsHome = await makeTempDir("clayon-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(skillsHome);

    await createClayonRepoSkill(currentRepo, "clayon");
    await createClayonRepoSkill(currentRepo, "agent-browser");
    await fs.symlink(
      path.join(currentRepo, "skills", "agent-browser"),
      path.join(skillsHome, "agent-browser"),
    );

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: clayonKey,
        runtimeName: "clayon",
        source: path.join(currentRepo, "skills", "clayon"),
      }],
    });

    expect((await fs.lstat(path.join(skillsHome, "clayon"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(path.join(skillsHome, "agent-browser"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "agent-browser")),
    );
  });
});
