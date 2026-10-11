import type { ProxyOptions } from "vite";
import { z } from "zod";

// Shared /api proxy used by both the vite dev server and `vite preview`.
// The `configure` hook forwards the client's original Host as
// x-forwarded-host so the clayon server's board mutation guard treats
// the browser's Origin as trusted when the SPA is served from a different
// port than the API (e.g. `pnpm dev:mobile` on :3101 → API on :3100).
// Dev UI against a deployed backend (e.g. https://clayon.curly.ng): the
// browser talks to the local vite server, vite forwards /api to the remote
// server. The remote server's origin guard and session cookies expect its own
// origin, so the proxy presents the remote origin upstream and strips the
// cookie Domain on the way back so the session sticks to localhost.
export function createRemoteApiProxy(target: string): Record<string, ProxyOptions> {
  return {
    "/api": {
      target,
      ws: true,
      changeOrigin: true,
      secure: true,
      cookieDomainRewrite: "",
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          proxyReq.setHeader("origin", target);
        });
        proxy.on("proxyReqWs", (proxyReq) => {
          proxyReq.setHeader("origin", target);
        });
      },
    },
  };
}

export function createApiProxy(target = "http://localhost:3100"): Record<string, ProxyOptions> {
  return {
    "/api": {
      target,
      ws: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq, req) => {
          const originalHost = req.headers.host;
          if (!originalHost) return;
          proxyReq.setHeader("x-forwarded-host", originalHost);
          // Prefer an upstream x-forwarded-proto (an HTTPS tunnel such as
          // ngrok or tailscale funnel terminates TLS and forwards HTTP to
          // vite with the header set). Fall back to the socket's TLS state.
          const protoList = z.array(z.string()).safeParse(req.headers["x-forwarded-proto"]);
          const protoSingle = z.string().safeParse(req.headers["x-forwarded-proto"]);
          const upstreamProto = protoList.success ? protoList.data[0] : protoSingle.success ? protoSingle.data : undefined;
          const tlsState = z.object({ encrypted: z.boolean() }).safeParse(req.socket);
          const isTls = tlsState.success && tlsState.data.encrypted === true;
          proxyReq.setHeader("x-forwarded-proto", upstreamProto ?? (isTls ? "https" : "http"));
        });
      },
    },
  };
}
