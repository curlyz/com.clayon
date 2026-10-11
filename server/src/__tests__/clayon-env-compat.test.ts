import { describe, expect, it } from "vitest";
import { applyClayonEnvCompat, readClayonEnv } from "../env-compat.js";

describe("applyClayonEnvCompat (CLAYON_ rename, backward compatible)", () => {
  it("prefers the CLAYON_ spelling when both are set", () => {
    const env: NodeJS.ProcessEnv = {
      CLAYON_PUBLIC_URL: "https://clayon.app",
      CLAYON_PUBLIC_URL: "https://legacy.example",
    };
    const applied = applyClayonEnvCompat(env);
    expect(env.CLAYON_PUBLIC_URL).toBe("https://clayon.app");
    expect(applied).toEqual(["CLAYON_PUBLIC_URL"]);
  });

  it("creates the legacy key when only the CLAYON_ spelling is set", () => {
    const env: NodeJS.ProcessEnv = { CLAYON_API_URL: "http://127.0.0.1:3100" };
    const applied = applyClayonEnvCompat(env);
    expect(env.CLAYON_API_URL).toBe("http://127.0.0.1:3100");
    expect(env.CLAYON_API_URL).toBe("http://127.0.0.1:3100");
    expect(applied).toEqual(["CLAYON_API_URL"]);
  });

  it("leaves a legacy-only value untouched", () => {
    const env: NodeJS.ProcessEnv = { CLAYON_AUTH_PUBLIC_BASE_URL: "https://legacy.example" };
    const applied = applyClayonEnvCompat(env);
    expect(env.CLAYON_AUTH_PUBLIC_BASE_URL).toBe("https://legacy.example");
    expect(applied).toEqual([]);
  });

  it("treats an empty CLAYON_ value as unset so the legacy value survives", () => {
    const env: NodeJS.ProcessEnv = {
      CLAYON_PUBLIC_URL: "",
      CLAYON_PUBLIC_URL: "https://legacy.example",
    };
    applyClayonEnvCompat(env);
    expect(env.CLAYON_PUBLIC_URL).toBe("https://legacy.example");
  });

  it("ignores keys outside the renamed prefix", () => {
    const env: NodeJS.ProcessEnv = { BETTER_AUTH_SECRET: "s", CLAYONISHThing: "x" };
    const applied = applyClayonEnvCompat(env);
    expect(applied).toEqual([]);
    expect(env.BETTER_AUTH_SECRET).toBe("s");
  });
});

describe("readClayonEnv", () => {
  it("reads through the CLAYON_ spelling first", () => {
    const env: NodeJS.ProcessEnv = {
      CLAYON_AUTH_GOOGLE_CLIENT_ID: "new-id",
      CLAYON_AUTH_GOOGLE_CLIENT_ID: "old-id",
    };
    expect(readClayonEnv("CLAYON_AUTH_GOOGLE_CLIENT_ID", env)).toBe("new-id");
  });

  it("falls back to the legacy spelling", () => {
    const env: NodeJS.ProcessEnv = { CLAYON_AUTH_GOOGLE_CLIENT_ID: "old-id" };
    expect(readClayonEnv("CLAYON_AUTH_GOOGLE_CLIENT_ID", env)).toBe("old-id");
  });

  it("returns undefined when neither spelling is set", () => {
    expect(readClayonEnv("CLAYON_AUTH_GOOGLE_CLIENT_ID", {})).toBeUndefined();
  });

  it("passes non-prefixed names through unchanged", () => {
    const env: NodeJS.ProcessEnv = { BETTER_AUTH_URL: "https://clayon.app" };
    expect(readClayonEnv("BETTER_AUTH_URL", env)).toBe("https://clayon.app");
  });
});
