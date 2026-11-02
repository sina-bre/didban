import { randomUUID } from "node:crypto";
import { LIMITS } from "@didban/contracts";
import { ConsoleLogger, RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../app.module.js";
import type { Env } from "../config/env.js";
import { httpMetricsHook } from "../modules/metrics/http-metrics.js";
import { Metrics } from "../modules/metrics/metrics.js";
import { csrfHook } from "./csrf-hook.js";
import { ErrorFilter } from "./error-filter.js";
import { ingestCorsHook } from "./ingest-cors.js";
import { useJsonBodyParser } from "./json-body-parser.js";
import { loggerOptions } from "./logger-options.js";
import { requestContextHook } from "./request-context.js";

/** Hop count -> the same predicate Fastify builds for numbers (its types only accept functions). */
function trustProxyOption(setting: Env["TRUST_PROXY"]) {
  if (Array.isArray(setting)) return setting;
  return setting === 0 ? false : (_address: string, hop: number) => hop < setting;
}

/** Nest's own logs (startup, DI): JSON in production so every line is machine-readable. */
function nestLogger(env: Env) {
  if (env.NODE_ENV === "test") return false;
  return env.NODE_ENV === "production"
    ? new ConsoleLogger({ json: true, colors: false })
    : undefined;
}

/** Builds the app. Used by `main.ts` and by tests (which call `init()` instead of `listen()`). */
export async function createApp(env: Env): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger: loggerOptions(env),
    bodyLimit: LIMITS.maxBodyBytes, // enforced on the stream before parsing (spec §7.1)
    trustProxy: trustProxyOption(env.TRUST_PROXY),
    genReqId: () => randomUUID(),
    requestIdHeader: false, // never trust a client-supplied request id
  });
  adapter.getInstance().addHook("onRequest", requestContextHook);
  adapter.getInstance().addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  adapter.getInstance().addHook("onRequest", ingestCorsHook);
  adapter.getInstance().addHook("onRequest", csrfHook(env));

  const app = await NestFactory.create<NestFastifyApplication>(AppModule.register(env), adapter, {
    logger: nestLogger(env),
  });
  adapter.getInstance().addHook("onResponse", httpMetricsHook(app.get(Metrics)));
  useJsonBodyParser(app, LIMITS.maxBodyBytes);
  // `/metrics` stays at the root, outside the `/api/*` path the proxies forward (ADR 0049).
  app.setGlobalPrefix("api/v1", { exclude: [{ path: "metrics", method: RequestMethod.GET }] });
  app.useGlobalFilters(new ErrorFilter());
  // Signals are handled in main.ts (graceful-shutdown.ts), not by Nest: drain before closing.
  return app;
}
