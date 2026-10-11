import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCursorSkills,
  syncCursorSkills,
} from "@clayon/adapter-cursor-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("cursor local skill sync", () => {
  const clayonKey = "clayon/clayon/clayon";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("defaults and installs the operational Clayon skill in the Cursor skills home", async () => {
    const home = await makeTempDir("clayon-cursor-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(clayonKey);
    expect(before.entries.find((entry) => entry.key === clayonKey)?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, [clayonKey]);
    expect(after.entries.find((entry) => entry.key === clayonKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "clayon"))).isSymbolicLink()).toBe(true);
  });

  it("keeps the operational skill installed after an explicit empty replacement", async () => {
    const home = await makeTempDir("clayon-cursor-required-skill-");
    cleanupDirs.add(home);

    const snapshot = await syncCursorSkills({
      agentId: "agent-required",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: { HOME: home },
        clayonSkillSync: { desiredSkills: [] },
      },
    }, []);

    expect(snapshot.desiredSkills).toEqual([clayonKey, "clayon/clayon/complain", "clayon/clayon/suggestion-box"]);
    expect(snapshot.entries.find((entry) => entry.key === clayonKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "clayon"))).isSymbolicLink()).toBe(true);
  });

  it("recognizes company-library runtime skills supplied outside the bundled Clayon directory", async () => {
    const home = await makeTempDir("clayon-cursor-runtime-skills-home-");
    const runtimeSkills = await makeTempDir("clayon-cursor-runtime-skills-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const clayonDir = await createSkillDir(runtimeSkills, "clayon");
    const asciiHeartDir = await createSkillDir(runtimeSkills, "ascii-heart");

    const ctx = {
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        clayonRuntimeSkills: [
          {
            key: "clayon",
            runtimeName: "clayon",
            source: clayonDir,
          },
          {
            key: "ascii-heart",
            runtimeName: "ascii-heart",
            source: asciiHeartDir,
          },
        ],
        clayonSkillSync: {
          desiredSkills: ["ascii-heart"],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.warnings).toEqual([]);
    expect(before.desiredSkills).toEqual(["ascii-heart"]);
    expect(before.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, ["ascii-heart"]);
    expect(after.warnings).toEqual([]);
    expect(after.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "ascii-heart"))).isSymbolicLink()).toBe(true);
  });

});
