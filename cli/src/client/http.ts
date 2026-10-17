import { URL } from "node:url";
import { z } from "zod";

export class ApiRequestError extends Error {
  status: number;
  details?: unknown;
  body?: unknown;

  constructor(status: number, message: string, details?: unknown, body?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.body = body;
  }
}

export class ApiConnectionError extends Error {
  url: string;
  method: string;
  causeMessage?: string;

  constructor(input: {
    apiBase: string;
    path: string;
    method: string;
    cause?: unknown;
  }) {
    const url = buildUrl(input.apiBase, input.path);
    const causeMessage = formatConnectionCause(input.cause);
    super(buildConnectionErrorMessage({ apiBase: input.apiBase, url, method: input.method, causeMessage }));
    this.url = url;
    this.method = input.method;
    this.causeMessage = causeMessage;
  }
}

interface RequestOptions {
  ignoreNotFound?: boolean;
}

interface RecoverAuthInput {
  path: string;
  method: string;
  error: ApiRequestError;
}

interface ApiClientOptions {
  apiBase: string;
  apiKey?: string;
  runId?: string;
  recoverAuth?: (input: RecoverAuthInput) => Promise<string | null>;
}

export class ClayonApiClient {
  readonly apiBase: string;
  apiKey?: string;
  readonly runId?: string;
  readonly recoverAuth?: (input: RecoverAuthInput) => Promise<string | null>;

  constructor(opts: ApiClientOptions) {
    this.apiBase = opts.apiBase.replace(/\/+$/, "");
    this.apiKey = opts.apiKey?.trim() || undefined;
    this.runId = opts.runId?.trim() || undefined;
    this.recoverAuth = opts.recoverAuth;
  }

  get<T>(path: string, opts?: RequestOptions): Promise<T | null> {
    return this.request<T>(path, { method: "GET" }, opts);
  }

  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T | null> {
    return this.request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }, opts);
  }

  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T | null> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }, opts);
  }

  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T | null> {
    return this.request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }, opts);
  }

  /** Raw binary upload (e.g. one chunked import-transfer part); the body travels as-is. */
  putRaw<T>(path: string, body: Uint8Array, opts?: RequestOptions): Promise<T | null> {
    return this.request<T>(path, {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "content-type": "application/octet-stream" },
    }, opts);
  }

  delete<T>(path: string, opts?: RequestOptions): Promise<T | null> {
    return this.request<T>(path, { method: "DELETE" }, opts);
  }

  setApiKey(apiKey: string | undefined) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    opts?: RequestOptions,
    hasRetriedAuth = false,
  ): Promise<T | null> {
    const url = buildUrl(this.apiBase, path);
    const method = String(init.method ?? "GET").toUpperCase();

    const headers: Record<string, string> = {
      accept: "application/json",
      ...toStringRecord(init.headers),
    };

    if (init.body !== undefined) {
      headers["content-type"] = headers["content-type"] ?? "application/json";
    }

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    if (this.runId) {
      headers["x-clayon-run-id"] = this.runId;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
      });
    } catch (error) {
      throw new ApiConnectionError({
        apiBase: this.apiBase,
        path,
        method,
        cause: error,
      });
    }

    if (opts?.ignoreNotFound && response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const apiError = await toApiError(response);
      if (!hasRetriedAuth && this.recoverAuth) {
        const recoveredToken = await this.recoverAuth({
          path,
          method,
          error: apiError,
        });
        if (recoveredToken) {
          this.setApiKey(recoveredToken);
          return this.request<T>(path, init, opts, true);
        }
      }
      throw apiError;
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text.trim()) {
      return null;
    }

    return safeParseJson(text) as T;
  }
}

function buildUrl(apiBase: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const [pathname, query] = normalizedPath.split("?");
  const url = new URL(apiBase);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}${pathname}`;
  if (query) url.search = query;
  return url.toString();
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const ERROR_BODY_SCHEMA = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
    details: z.unknown().optional(),
  });

async function toApiError(response: Response): Promise<ApiRequestError> {
  const text = await response.text();
  const parsed = safeParseJson(text);
  const body = ERROR_BODY_SCHEMA.safeParse(parsed);

  if (body.success) {
    const message =
      body.data.error?.trim() ||
      body.data.message?.trim() ||
      `Request failed with status ${response.status}`;

    return new ApiRequestError(response.status, message, body.data.details, parsed);
  }

  return new ApiRequestError(response.status, `Request failed with status ${response.status}`, undefined, parsed);
}

function buildConnectionErrorMessage(input: {
  apiBase: string;
  url: string;
  method: string;
  causeMessage?: string;
}): string {
  const healthUrl = buildHealthCheckUrl(input.url);
  const lines = [
    "Could not reach the Clayon API.",
    "",
    `Request: ${input.method} ${input.url}`,
  ];
  if (input.causeMessage) {
    lines.push(`Cause: ${input.causeMessage}`);
  }
  lines.push(
    "",
    "This usually means the Clayon server is not running, the configured URL is wrong, or the request is being blocked before it reaches Clayon.",
    "",
    "Try:",
    "- Start Clayon with `bun run dev` (from a source checkout) or `npx clayon run`.",
    `- Verify the server is reachable with \`curl ${healthUrl}\`.`,
    `- If Clayon is running elsewhere, pass \`--api-base ${input.apiBase.replace(/\/+$/, "")}\` or set \`CLAYON_API_URL\`.`,
  );
  return lines.join("\n");
}

function buildHealthCheckUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "").replace(/\/api(?:\/.*)?$/, "")}/api/health`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function formatConnectionCause(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return error.message.trim() || error.name;
  }
  const message = String(error).trim();
  return message || undefined;
}

function toStringRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]));
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)]),
  );
}
