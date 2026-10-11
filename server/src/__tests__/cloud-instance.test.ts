import { describe, expect, it } from "vitest";
import {
  getCloudStackContext,
  isCloudManagedInstance,
  type CloudInstanceEnv,
} from "../services/cloud-instance.js";

describe("isCloudManagedInstance", () => {
  it("unifies both prior signals without weakening either restrictive floor", () => {
    const cases: CloudInstanceEnv[] = [
      {},
      { CLAYON_CLOUD_TENANT_SERVER_TOKEN: "tenant-token" },
      { CLAYON_MANAGED_CONFIG: "" },
      {
        CLAYON_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
        CLAYON_MANAGED_CONFIG: "managed-document",
      },
    ];

    for (const env of cases) {
      const priorTokenFloor = Boolean(env.CLAYON_CLOUD_TENANT_SERVER_TOKEN?.trim());
      const priorManagedConfigFloor = env.CLAYON_MANAGED_CONFIG !== undefined;
      const canonicalFloor = isCloudManagedInstance(env);

      expect(canonicalFloor).toBe(priorTokenFloor || priorManagedConfigFloor);
      expect(canonicalFloor || !priorTokenFloor).toBe(true);
      expect(canonicalFloor || !priorManagedConfigFloor).toBe(true);
    }
  });

  it("does not treat a blank tenant token alone as a managed signal", () => {
    expect(isCloudManagedInstance({ CLAYON_CLOUD_TENANT_SERVER_TOKEN: "   " })).toBe(false);
  });
});

describe("getCloudStackContext", () => {
  it("returns null outside Clayon Cloud even when stray stack metadata exists", () => {
    expect(getCloudStackContext({ CLAYON_STACK_SLUG: "stray-stack" })).toBeNull();
  });

  it("returns normalized provisioner metadata for cloud instances", () => {
    expect(getCloudStackContext({
      CLAYON_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
      CLAYON_CLOUD_STACK_ID: " stack-1 ",
      CLAYON_STACK_SLUG: " acme ",
      CLAYON_CLOUD_ACCOUNT_GROUP_ID: " account-group-1 ",
      CLAYON_PRIMARY_HOST: " acme.clayon.app ",
      CLAYON_CLOUD_API_ORIGIN: " https://app.clayon.app ",
    })).toEqual({
      stackId: "stack-1",
      stackSlug: "acme",
      accountGroupId: "account-group-1",
      primaryHost: "acme.clayon.app",
      cloudOrigin: "https://app.clayon.app",
    });
  });

  it("represents missing managed metadata explicitly without failing health checks", () => {
    expect(getCloudStackContext({ CLAYON_MANAGED_CONFIG: "managed-document" })).toEqual({
      stackId: null,
      stackSlug: null,
      accountGroupId: null,
      primaryHost: null,
      cloudOrigin: null,
    });
  });
});
