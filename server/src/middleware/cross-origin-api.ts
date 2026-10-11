import type { RequestHandler } from "express";

/**
 * Credential-bearing CORS for cross-origin API callers (the native mobile
 * shell's WebView origin). Only origins listed in
 * `server.crossOriginApiOrigins` (env `CLAYON_CROSS_ORIGIN_API_ORIGINS`)
 * receive CORS headers; every other request passes through untouched, which
 * preserves today's same-origin behavior. Mounted before all /api routes.
 */

const CORS_ALLOW_HEADERS = [
  "Content-Type",
  "Authorization",
  "If-None-Match",
  "X-Clayon-*",
  "x-clayon-*",
].join(", ");

const CORS_ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_MAX_AGE = "86400";

export function crossOriginApiMiddleware(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  if (allowed.size === 0) {
    // Empty allowlist: no request can match, skip the header work entirely.
    return (_req, _res, next) => next();
  }
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin === undefined || !allowed.has(origin)) {
      next();
      return;
    }
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS" && req.path.startsWith("/api")) {
      res.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
      res.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
      res.set("Access-Control-Max-Age", CORS_MAX_AGE);
      res.status(204).end();
      return;
    }
    next();
  };
}
