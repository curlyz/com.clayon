import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crossOriginApiMiddleware } from "../middleware/cross-origin-api.js";
import {
  buildBetterAuthAdvancedOptions,
  isCrossOriginAuthRequest,
} from "../auth/better-auth.js";

const ALLOWED = "https://app.clayon.curly.ng";
const UNKNOWN = "https://evil.example.com";

function buildApp(allowedOrigins: string[]) {
  const app = express();
  app.use(crossOriginApiMiddleware(allowedOrigins));
  app.use("/api", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("cross-origin API CORS middleware", () => {
  it("echoes an allowlisted origin with credentials and Vary", async () => {
    const res = await request(buildApp([ALLOWED]))
      .get("/api/companies")
      .set("Origin", ALLOWED);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers.vary).toBe("Origin");
  });

  it("passes unknown origins through untouched", async () => {
    const res = await request(buildApp([ALLOWED]))
      .get("/api/companies")
      .set("Origin", UNKNOWN);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("passes same-origin (no Origin header) requests untouched", async () => {
    const res = await request(buildApp([ALLOWED])).get("/api/companies");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers preflights for allowlisted origins with 204 and header grants", async () => {
    const res = await request(buildApp([ALLOWED]))
      .options("/api/issues")
      .set("Origin", ALLOWED)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type, x-clayon-token");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    const allowHeaders = String(res.headers["access-control-allow-headers"]);
    expect(allowHeaders).toContain("Content-Type");
    expect(allowHeaders).toContain("Authorization");
    expect(allowHeaders).toContain("If-None-Match");
    expect(allowHeaders).toContain("X-Clayon-*");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-max-age"]).toBe("86400");
  });

  it("does not answer preflights for unknown origins", async () => {
    const res = await request(buildApp([ALLOWED]))
      .options("/api/issues")
      .set("Origin", UNKNOWN)
      .set("Access-Control-Request-Method", "POST");
    // Falls through to the route stack; Express answers OPTIONS /api via the
    // mounted router — the point is that no CORS grant is attached.
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("cross-origin auth cookie switching", () => {
  it("adds SameSite=None; Secure attributes only when requested", () => {
    const crossOrigin = buildBetterAuthAdvancedOptions({
      disableSecureCookies: false,
      crossOriginCookies: true,
    });
    expect(crossOrigin.defaultCookieAttributes).toEqual({
      sameSite: "none",
      secure: true,
    });

    const sameOrigin = buildBetterAuthAdvancedOptions({
      disableSecureCookies: false,
    });
    expect(sameOrigin.defaultCookieAttributes).toBeUndefined();
  });

  it("never combines SameSite=None with an insecure loopback instance", () => {
    const loopback = buildBetterAuthAdvancedOptions({
      disableSecureCookies: true,
      crossOriginCookies: true,
    });
    expect(loopback.useSecureCookies).toBe(false);
    expect(loopback.defaultCookieAttributes).toBeUndefined();
  });

  it("recognizes exactly the allowlisted origins as cross-origin auth requests", () => {
    expect(isCrossOriginAuthRequest(ALLOWED, [ALLOWED])).toBe(true);
    expect(isCrossOriginAuthRequest(UNKNOWN, [ALLOWED])).toBe(false);
    expect(isCrossOriginAuthRequest(null, [ALLOWED])).toBe(false);
    expect(isCrossOriginAuthRequest(undefined, [ALLOWED])).toBe(false);
  });
});
