import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveClayonHomeDir,
  resolveClayonInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.clayon and default instance", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "clayon-home-paths-"));
    process.env.CLAYON_HOME = home;
    delete process.env.CLAYON_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(home);
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(home, "instances", "default", "config.json"));
  });

  it("supports CLAYON_HOME and explicit instance ids", () => {
    process.env.CLAYON_HOME = "~/clayon-home";

    const home = resolveClayonHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "clayon-home"));
    expect(resolveClayonInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveClayonInstanceId("bad/id")).toThrow(/Invalid CLAYON_INSTANCE_ID/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
