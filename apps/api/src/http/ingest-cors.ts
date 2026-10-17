import type { FastifyReply, FastifyRequest } from "fastify";

// Spec §6.1: tracked sites call ingestion cross-origin. No cookies or credentials are involved
// (the write key travels in the body or a header), so `*` is safe; the per-environment Origin
// allowlist is checked by the pipeline. Set in `onRequest` so error responses carry it too.
const INGEST_PREFIX = "/api/v1/ingest/";
const PREFLIGHT_MAX_AGE_S = "86400";

export async function ingestCorsHook(request: FastifyRequest, reply: FastifyReply) {
  if (!request.url.startsWith(INGEST_PREFIX)) return;
  reply.header("access-control-allow-origin", "*");
  reply.header("access-control-expose-headers", "retry-after, x-request-id");
  if (request.method !== "OPTIONS") return;
  reply.header("access-control-allow-methods", "POST");
  reply.header("access-control-allow-headers", "content-type, x-write-key");
  reply.header("access-control-max-age", PREFLIGHT_MAX_AGE_S);
}
