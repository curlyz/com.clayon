import type { Request, RequestHandler } from "express";
import type { IncomingHttpHeaders } from "node:http";
import { betterAuth, type Auth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { toNodeHandler } from "better-auth/node";
import { passkey } from "@better-auth/passkey";
import type { Db } from "@clayon/db";
import {
  authAccounts,
  authPasskeys,
  authSessions,
  authUsers,
  authVerifications,
} from "@clayon/db";
import type { Config } from "../config.js";
import { readClayonEnv } from "../env-compat.js";
import { resolveClayonInstanceId } from "../home-paths.js";
import {
  workspaceLoginHandoffPlugin,
  type WorkspaceHandoffExpectedIdentity,
} from "./workspace-login-handoff-plugin.js";
import {
  normalizeWorkspaceHandoffOrigin,
  resolveWorkspaceHandoffLocalCompanyId,
  resolveWorkspaceHandoffLocalKey,
  resolveWorkspaceHandoffLocalWorkspaceId,
} from "./workspace-login-handoff.js";

export type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type BetterAuthSessionResult = {
  session: { id: string; userId: string } | null;
  user: BetterAuthSessionUser | null;
};

type BetterAuthGetSessionApi = {
  getSession?: (input: { headers: Headers }) => Promise<unknown>;
};

type BetterAuthHandlerTarget = Extract<Parameters<typeof toNodeHandler>[0], { handler: Auth["handler"] }>;

type BetterAuthSessionResolver = {
  api?: BetterAuthGetSessionApi;
};

type BetterAuthInstance = BetterAuthHandlerTarget & BetterAuthSessionResolver;

const AUTH_COOKIE_PREFIX_FALLBACK = "default";
const AUTH_COOKIE_PREFIX_INVALID_SEGMENTS_RE = /[^a-zA-Z0-9_-]+/g;

export function deriveAuthCookiePrefix(instanceId = resolveClayonInstanceId()): string {
  const scopedInstanceId = instanceId
    .trim()
    .replace(AUTH_COOKIE_PREFIX_INVALID_SEGMENTS_RE, "-")
    .replace(/^-+|-+$/g, "") || AUTH_COOKIE_PREFIX_FALLBACK;
  return `clayon-${scopedInstanceId}`;
}

export function buildBetterAuthAdvancedOptions(input: {
  disableSecureCookies: boolean;
  /**
   * Emit SameSite=None; Secure session cookies so allowlisted cross-origin
   * callers (the native mobile shell's WebView) keep their session. Only
   * meaningful together with the Secure attribute, so a loopback (insecure)
   * instance never carries it.
   */
  crossOriginCookies?: boolean;
}) {
  const crossOriginCookieAttributes = {
    sameSite: "none",
    secure: true,
  } satisfies {
    sameSite: "strict" | "lax" | "none" | "Strict" | "Lax" | "None";
    secure: boolean;
  };
  return {
    cookiePrefix: deriveAuthCookiePrefix(),
    ...(input.disableSecureCookies ? { useSecureCookies: false } : {}),
    ...(input.crossOriginCookies && !input.disableSecureCookies
      ? { defaultCookieAttributes: crossOriginCookieAttributes }
      : {}),
  };
}

/** True when the request Origin is an allowlisted cross-origin API origin. */
export function isCrossOriginAuthRequest(
  origin: string | null | undefined,
  allowedOrigins: string[],
): boolean {
  if (origin === null || origin === undefined) return false;
  return allowedOrigins.includes(origin);
}

export function shouldEnableAuthRateLimit(input: {
  deploymentMode: Config["deploymentMode"];
  deploymentExposure?: Config["deploymentExposure"];
  override?: string | undefined;
}): boolean {
  const override = input.override?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  return input.deploymentMode === "authenticated";
}

export function buildBetterAuthRateLimitOptions(input: {
  deploymentMode: Config["deploymentMode"];
  deploymentExposure?: Config["deploymentExposure"];
  override?: string | undefined;
}) {
  return {
    enabled: shouldEnableAuthRateLimit(input),
  };
}

/**
 * Google social sign-in, configured only when both credentials are set
 * (trimmed, non-empty); otherwise no social provider is registered at all.
 * `disableSignUp` follows the existing email sign-up policy so a public
 * instance never lets an arbitrary Google account create a user — an existing
 * user whose verified email matches still signs in via Better Auth's default
 * account linking.
 */
export function resolveGoogleSocialProvider(input: {
  clientId: string | undefined;
  clientSecret: string | undefined;
  disableSignUp: boolean;
}): { google: { clientId: string; clientSecret: string; disableSignUp: boolean } } | null {
  const clientId = input.clientId?.trim();
  const clientSecret = input.clientSecret?.trim();
  if (!clientId || !clientSecret) return null;
  return { google: { clientId, clientSecret, disableSignUp: input.disableSignUp } };
}

/** Social provider ids /api/health advertises — provider names only, never a secret. */
export function enabledAuthSocialProviders(env: NodeJS.ProcessEnv = process.env): string[] {
  return resolveGoogleSocialProvider({
    clientId: readClayonEnv("CLAYON_AUTH_GOOGLE_CLIENT_ID", env),
    clientSecret: readClayonEnv("CLAYON_AUTH_GOOGLE_CLIENT_SECRET", env),
    disableSignUp: false,
  }) ? ["google"] : [];
}

export interface AuthPasskeyRelyingParty {
  rpName: string;
  rpID: string;
  origin: string;
}

/**
 * WebAuthn relying-party identity, derived from the instance's public base
 * URL (rpID = hostname, origin = scheme + host). Passkeys are bound to the
 * rpID, so the plugin is only registered when a public URL is resolvable —
 * a loopback-only instance has no stable domain to bind credentials to.
 */
export function resolveAuthPasskeyRelyingParty(input: {
  publicBaseUrl: string | undefined;
}): AuthPasskeyRelyingParty | null {
  const candidate = input.publicBaseUrl?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return null;
    return { rpName: "Clayon", rpID: parsed.hostname, origin: parsed.origin };
  } catch {
    return null;
  }
}

/**
 * Whether /api/health should advertise passkey sign-in. Env-only mirror of
 * the public-URL resolution createBetterAuthInstance uses (CLAYON_PUBLIC_URL
 * first, then the auth base URL family), so the sign-in page's gating agrees
 * with the plugin registration on env-configured deployments.
 */
export function passkeySignEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const publicBaseUrl =
    readClayonEnv("CLAYON_PUBLIC_URL", env)?.trim() ||
    readClayonEnv("CLAYON_AUTH_PUBLIC_BASE_URL", env)?.trim() ||
    env.BETTER_AUTH_URL?.trim() ||
    readClayonEnv("CLAYON_MANAGED_RUNTIME_PUBLIC_URL", env)?.trim() ||
    undefined;
  return resolveAuthPasskeyRelyingParty({ publicBaseUrl }) !== null;
}

export function shouldDisableSecureAuthCookies(input: {
  deploymentMode: Config["deploymentMode"];
  deploymentExposure?: Config["deploymentExposure"];
  authBaseUrlMode: Config["authBaseUrlMode"];
  authPublicBaseUrl: string | undefined;
  publicUrl?: string | undefined;
  managedRuntimePublicUrl?: string | undefined;
  requestUrl?: string | undefined;
}): boolean {
  const publicUrl = (
    input.publicUrl?.trim() ||
    (input.authBaseUrlMode === "explicit" ? input.authPublicBaseUrl?.trim() : "")
  );
  if (
    input.deploymentMode === "authenticated" &&
    isHttpsUrl(publicUrl) &&
    isHttpsUrl(input.managedRuntimePublicUrl) &&
    isHttpLoopbackUrl(input.requestUrl)
  ) {
    return true;
  }
  if (publicUrl) return publicUrl.startsWith("http://");

  return (
    input.deploymentMode === "authenticated" &&
    (
      (input.deploymentExposure === "private" && input.authBaseUrlMode === "auto") ||
      input.deploymentExposure === undefined
    )
  );
}

function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "::1"
  );
}

function isHttpLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

function requestUrlFromHeaders(headers: Headers): string | undefined {
  const host = headers.get("host")?.trim();
  if (!host) return undefined;

  const forwardedProtocol = headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : (() => {
      try {
        return isLoopbackHostname(new URL(`http://${host}`).hostname) ? "http" : "https";
      } catch {
        return "https";
      }
    })();
  return `${protocol}://${host}`;
}

function headersFromNodeHeaders(rawHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, raw] of Object.entries(rawHeaders)) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) headers.append(key, value);
      continue;
    }
    headers.set(key, raw);
  }
  return headers;
}

function headersFromExpressRequest(req: Request): Headers {
  return headersFromNodeHeaders(req.headers);
}

export function deriveAuthTrustedOrigins(config: Config, opts?: { listenPort?: number }): string[] {
  const baseUrl = config.authBaseUrlMode === "explicit" ? config.authPublicBaseUrl : undefined;
  const trustedOrigins = new Set<string>();

  if (baseUrl) {
    try {
      trustedOrigins.add(new URL(baseUrl).origin);
    } catch {
      // Better Auth will surface invalid base URL separately.
    }
  }
  if (config.deploymentMode === "authenticated") {
    const port = opts?.listenPort ?? config.port;
    const needsPortVariants = port !== 80 && port !== 443;
    for (const hostname of config.allowedHostnames) {
      const trimmed = hostname.trim().toLowerCase();
      if (!trimmed) continue;
      trustedOrigins.add(`https://${trimmed}`);
      trustedOrigins.add(`http://${trimmed}`);
      if (needsPortVariants) {
        trustedOrigins.add(`https://${trimmed}:${port}`);
        trustedOrigins.add(`http://${trimmed}:${port}`);
      }
    }
  }
  // Cross-origin API origins are full origins already — trust them verbatim
  // so Better Auth's origin check accepts the shell's auth POSTs.
  for (const origin of config.crossOriginApiOrigins) {
    const trimmed = origin.trim();
    if (trimmed) trustedOrigins.add(trimmed);
  }

  return Array.from(trustedOrigins);
}

/**
 * Identity a managed workspace instance compares an inbound handoff ticket
 * against. Every field comes from persisted configuration or injected runtime
 * identity — never from request headers — so a spoofed `X-Forwarded-Host` or
 * Tailscale identity header cannot retarget a ticket. Returns null when this
 * process was not started as a managed workspace, which leaves the exchange
 * endpoint unregistered.
 */
export function resolveWorkspaceHandoffIdentity(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
): WorkspaceHandoffExpectedIdentity | null {
  const key = resolveWorkspaceHandoffLocalKey(env);
  if (!key) return null;
  const configuredOrigin =
    normalizeWorkspaceHandoffOrigin(env.CLAYON_PUBLIC_URL)
    ?? (config.authBaseUrlMode === "explicit"
      ? normalizeWorkspaceHandoffOrigin(config.authPublicBaseUrl)
      : null);
  return {
    key,
    instanceId: resolveClayonInstanceId(),
    executionWorkspaceId: resolveWorkspaceHandoffLocalWorkspaceId(env),
    companyId: resolveWorkspaceHandoffLocalCompanyId(env),
    origin: configuredOrigin,
  };
}

export function createBetterAuthInstance(db: Db, config: Config, trustedOrigins: string[]): BetterAuthInstance {
  const baseUrl = config.authBaseUrlMode === "explicit" ? config.authPublicBaseUrl : undefined;
  const publicUrl = process.env.CLAYON_PUBLIC_URL?.trim() || baseUrl;
  const managedRuntimePublicUrl = process.env.CLAYON_MANAGED_RUNTIME_PUBLIC_URL?.trim() || undefined;
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.CLAYON_AGENT_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET (or CLAYON_AGENT_JWT_SECRET) must be set. " +
      "For local development, set BETTER_AUTH_SECRET=clayon-dev-secret in your .env file.",
    );
  }
  const disableSecureCookies = shouldDisableSecureAuthCookies({
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authBaseUrlMode: config.authBaseUrlMode,
    authPublicBaseUrl: config.authPublicBaseUrl,
    publicUrl,
  });
  const googleSocialProvider = resolveGoogleSocialProvider({
    clientId: process.env.CLAYON_AUTH_GOOGLE_CLIENT_ID,
    clientSecret: process.env.CLAYON_AUTH_GOOGLE_CLIENT_SECRET,
    disableSignUp: config.authDisableSignUp,
  });
  const passkeyRelyingParty = resolveAuthPasskeyRelyingParty({ publicBaseUrl: publicUrl || baseUrl });
  const authPlugins = [
    ...(passkeyRelyingParty ? [passkey(passkeyRelyingParty)] : []),
    ...(resolveWorkspaceHandoffIdentity(config)
      ? [
          workspaceLoginHandoffPlugin({
            db,
            // Re-resolved per exchange so a hot restart cannot keep validating
            // against an origin the control plane has since republished.
            resolveExpectedIdentity: () =>
              resolveWorkspaceHandoffIdentity(config) ?? {
                key: null,
                instanceId: null,
                executionWorkspaceId: null,
                companyId: null,
                origin: null,
              },
          }),
        ]
      : []),
  ];

  const authConfig = {
    baseURL: baseUrl,
    secret,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        passkey: authPasskeys,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: config.authDisableSignUp,
    },
    // Registered only when both Google credentials are configured; the spread
    // below keeps an unconfigured instance free of any social provider.
    ...(googleSocialProvider ? { socialProviders: googleSocialProvider } : {}),
    rateLimit: buildBetterAuthRateLimitOptions({
      deploymentMode: config.deploymentMode,
      deploymentExposure: config.deploymentExposure,
      override: process.env.CLAYON_AUTH_RATE_LIMIT_ENABLED,
    }),
    advanced: buildBetterAuthAdvancedOptions({ disableSecureCookies }),
    // Passkey sign-in is registered only when the instance has a public base
    // URL to derive the WebAuthn relying party from; the workspace handoff
    // plugin only for a managed workspace instance (the plugin is what makes
    // `Open workspace` password-independent, and a control-plane instance that
    // was never handed a workspace key must not expose the exchange at all).
    ...(authPlugins.length > 0 ? { plugins: authPlugins } : {}),
  };

  if (!baseUrl) {
    delete (authConfig as { baseURL?: string }).baseURL;
  }

  const defaultAuth = betterAuth(authConfig);
  const crossOriginOrigins = config.crossOriginApiOrigins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  // A dedicated instance carries SameSite=None; Secure session cookies so the
  // native shell's cross-site WebView calls keep their session. Skipped when
  // secure cookies are disabled (SameSite=None without Secure is rejected by
  // browsers outright) or the allowlist is empty.
  const crossOriginAuth = crossOriginOrigins.length > 0 && !disableSecureCookies
    ? betterAuth({
        ...authConfig,
        advanced: buildBetterAuthAdvancedOptions({
          disableSecureCookies: false,
          crossOriginCookies: true,
        }),
      })
    : null;
  const supportsManagedLoopbackAuth = Boolean(
    !disableSecureCookies &&
    isHttpsUrl(publicUrl) &&
    isHttpsUrl(managedRuntimePublicUrl),
  );
  if (!supportsManagedLoopbackAuth && !crossOriginAuth) return defaultAuth;

  // Better Auth fixes both the Secure attribute and the __Secure- name prefix
  // when an instance is created. Keep the public instance unchanged and route
  // only managed HTTP-loopback requests through a cookie-compatible instance.
  const loopbackAuth = supportsManagedLoopbackAuth
    ? betterAuth({
        ...authConfig,
        advanced: buildBetterAuthAdvancedOptions({ disableSecureCookies: true }),
      })
    : null;
  const cookieSecurityInput = {
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authBaseUrlMode: config.authBaseUrlMode,
    authPublicBaseUrl: config.authPublicBaseUrl,
    publicUrl,
    managedRuntimePublicUrl,
  };
  const selectAuth = (url: string | undefined, headers: Headers) => {
    if (crossOriginAuth && isCrossOriginAuthRequest(headers.get("origin"), crossOriginOrigins)) {
      return crossOriginAuth;
    }
    if (loopbackAuth && shouldDisableSecureAuthCookies({ ...cookieSecurityInput, requestUrl: url })) {
      return loopbackAuth;
    }
    return defaultAuth;
  };

  return {
    handler: (request) => selectAuth(request.url, request.headers).handler(request),
    api: {
      getSession: (input) => selectAuth(requestUrlFromHeaders(input.headers), input.headers).api.getSession(input),
    },
  };
}

export function createBetterAuthHandler(auth: BetterAuthHandlerTarget): RequestHandler {
  const handler = toNodeHandler(auth);
  return (req, res, next) => {
    void Promise.resolve(handler(req, res)).catch(next);
  };
}

export async function resolveBetterAuthSessionFromHeaders(
  auth: BetterAuthSessionResolver,
  headers: Headers,
): Promise<BetterAuthSessionResult | null> {
  const api = auth.api;
  if (!api?.getSession) return null;

  const sessionValue = await api.getSession({
    headers,
  });
  if (!sessionValue || typeof sessionValue !== "object") return null;

  const value = sessionValue as {
    session?: { id?: string; userId?: string } | null;
    user?: { id?: string; email?: string | null; name?: string | null } | null;
  };
  const session = value.session?.id && value.session.userId
    ? { id: value.session.id, userId: value.session.userId }
    : null;
  const user = value.user?.id
    ? {
        id: value.user.id,
        email: value.user.email ?? null,
        name: value.user.name ?? null,
      }
    : null;

  if (!session || !user) return null;
  return { session, user };
}

export async function resolveBetterAuthSession(
  auth: BetterAuthSessionResolver,
  req: Request,
): Promise<BetterAuthSessionResult | null> {
  return resolveBetterAuthSessionFromHeaders(auth, headersFromExpressRequest(req));
}
