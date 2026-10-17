import spec from "@clayon/openapi/spec.json";
import { inferdiHono, type InferdiHonoEnv } from "@inferdi/hono";
import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { Hono } from "hono";

import { createAppScope, root } from "./container";
import { router } from "./router";

/*
 * The rung-1 public surface of the Paperclip gateway on the OpenAPI-first
 * recipe (moe:orpc/recipe-openapi-first-heygen): packages/openapi/openapi.yaml
 * is the source of truth, the contract is generated from it, and this Worker
 * serves every path through one router with two doors:
 *   /api/<spec path>    the REST door (oRPC OpenAPIHandler)
 *   /api/rpc/<opId>     the oRPC RPC door for typed clients
 *   /api/openapi.json   the checked-in spec, bundled verbatim by redocly
 *
 * The InferDI middleware opens one scope per request; the /api middleware
 * disposes it (LIFO teardown destroys the scoped pg pool) via waitUntil
 * after the response. Every /api response, errors included, is no-store and
 * carries x-request-id (echoed when sent).
 */

type GatewayHonoEnv = { Bindings: PaperclipGatewayEnv } & InferdiHonoEnv<typeof root>;

const app = new Hono<GatewayHonoEnv>();

app.use(
  "*",
  inferdiHono<typeof root, GatewayHonoEnv>({
    container: root,
    createScope: (_request, c) => createAppScope(c.env),
  }),
);

const rpc = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});
const rest = new OpenAPIHandler(router, {
  interceptors: [onError((error) => console.error(error))],
  plugins: [new SmartCoercionHandlerPlugin({ converters: [new ZodToJsonSchemaConverter()] })],
});

// One scope end per request: dispose after the response settles (waitUntil,
// never blocking the reply) and stamp the envelope headers.
app.use("/api/*", async (c, next) => {
  await next();
  c.executionCtx.waitUntil(c.var.di.dispose().catch(() => undefined));
  const headers = new Headers(c.res.headers);
  headers.set("Cache-Control", "no-store");
  if (!headers.has("x-request-id")) {
    const echoed = c.req.header("x-request-id");
    headers.set(
      "x-request-id",
      echoed !== undefined && echoed !== "" ? echoed : crypto.randomUUID(),
    );
  }
  c.res = new Response(c.res.body, { status: c.res.status, headers });
});

// The RPC door (typed oRPC clients).
app.use("/api/rpc/*", async (c, next) => {
  const { matched, response } = await rpc.handle(c.req.raw, {
    prefix: "/api/rpc",
    context: { di: c.var.di },
  });
  if (matched) return c.newResponse(response.body, response);
  await next();
});

// The REST door: the spec's own paths under /api (path-based API law).
app.use("/api/*", async (c, next) => {
  const { matched, response } = await rest.handle(c.req.raw, {
    prefix: "/api",
    context: { di: c.var.di },
  });
  if (matched) return c.newResponse(response.body, response);
  await next();
});

// The served document IS the checked-in source of truth (packages/openapi/
// openapi.yaml -> redocly bundle -> spec.json), served byte-equal as raw
// text. `pnpm check:openapi` fails when this file drifts from the spec.
app.get("/api/openapi.json", (c) => c.body(spec, 200, { "content-type": "application/json" }));

export default app;
