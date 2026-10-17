import { ingestError } from "./ingest-error.js";

// Spec §6.1: the SDK sends `text/plain` (a CORS-simple request), which Fastify hands over as a
// string; `application/json` arrives already parsed (Fastify answers bad JSON itself, mapped to
// INVALID_JSON by the error filter). The body limit has already been enforced on the stream.

export type BatchBody = Record<string, unknown>;

export function readBatchBody(body: unknown): BatchBody {
  let value = body;
  if (typeof body === "string") {
    try {
      value = JSON.parse(body);
    } catch {
      throw ingestError("INVALID_JSON", "Body is not valid JSON");
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw ingestError("INVALID_ENVELOPE", "Body must be a JSON object");
  }
  return value as BatchBody;
}

/** The `X-Write-Key` header (server keys, tools) wins over the body field (browser SDK). */
export function writeKeyOf(body: BatchBody, header: string | undefined): string | undefined {
  if (header) return header;
  return typeof body.writeKey === "string" ? body.writeKey : undefined;
}
