import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../config/env.js";

// Spec §11 + ADR 0009: same-origin dashboard, so CSRF protection is a JSON content type plus an
// Origin (or Sec-Fetch-Site: same-origin) check on every state-changing request. Ingestion is
// cross-origin by design and has its own boundary (write keys, per-environment origins).
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PREFIXES = ["/api/v1/ingest/"];

function reject(request: FastifyRequest, reply: FastifyReply, status: 403 | 415) {
  const [code, message] =
    status === 403
      ? ["CSRF_REJECTED", "Cross-site request rejected"]
      : ["UNSUPPORTED_MEDIA_TYPE", "Content type must be application/json"];
  return reply.code(status).send({ error: { code, message, requestId: request.id } });
}

/** Fastify `onRequest` hook: runs before body parsing, so rejected bodies are never read. */
export function csrfHook(env: Env) {
  const publicOrigin = new URL(env.PUBLIC_ORIGIN).origin;
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (EXEMPT_PREFIXES.some((prefix) => request.url.startsWith(prefix))) return;
    const origin = request.headers.origin;
    const sameOrigin = origin
      ? origin === publicOrigin
      : request.headers["sec-fetch-site"] === "same-origin";
    if (!sameOrigin) return reject(request, reply, 403);
    const type = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json") return reject(request, reply, 415);
  };
}
