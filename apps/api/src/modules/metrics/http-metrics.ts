import type { FastifyReply, FastifyRequest } from "fastify";
import type { Metrics } from "./metrics.js";

// Request-level metrics from one Fastify `onResponse` hook: ingest requests (status, error code,
// latency) and stats latency by route template. Errors answered by Fastify itself (body limit,
// bad JSON) pass the error filter too, which notes the contract code here.

const INGEST_ROUTE = "/api/v1/ingest/batch";
const errorCodes = new WeakMap<FastifyRequest, string>();

export function noteErrorCode(request: FastifyRequest, code: string): void {
  errorCodes.set(request, code);
}

export function httpMetricsHook(metrics: Metrics) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const route = request.routeOptions.url;
    if (!route) return;
    const status = String(reply.statusCode);
    const seconds = reply.elapsedTime / 1000;
    if (route === INGEST_ROUTE && request.method === "POST") {
      metrics.ingestRequests.inc({ status, code: errorCodes.get(request) ?? "" });
      metrics.ingestDuration.observe(seconds);
    } else if (route.includes("/stats/")) {
      metrics.statsDuration.observe({ endpoint: route.replace("/api/v1/", ""), status }, seconds);
    }
  };
}
