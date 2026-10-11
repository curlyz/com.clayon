import { describe, expect, it } from "vitest";
import { sanitizeInheritedClayonEnv } from "./server-utils.js";

describe("sanitizeInheritedClayonEnv", () => {
  it("drops the host-only Clayon CLI command pointer", () => {
    expect(sanitizeInheritedClayonEnv({
      CLAYON_CMD: "node /missing/clayon/dist/index.js",
      CLAYON_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    })).toEqual({
      CLAYON_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    });
  });
});
