import { z } from "zod";
import { EVENT_REJECTION_CODES } from "./error-codes.js";
import { LIMITS } from "./limits.js";

const screenSide = z.number().int().min(0).max(20_000);

const contextSchema = z.object({
  sdk: z.object({ name: z.string().max(64), version: z.string().max(32) }).optional(),
  locale: z.string().max(35).optional(),
  screen: z.object({ w: screenSide, h: screenSide }).optional(),
  timezone: z.string().max(64).optional(),
});

/**
 * Batch envelope (spec §6.1). `events` stays `unknown[]` here: each event is validated on its own
 * with `eventSchema`, so one bad event does not reject the batch. The server checks
 * `schemaVersion` before this schema so it can answer UNSUPPORTED_SCHEMA_VERSION.
 */
export const batchEnvelopeSchema = z.object({
  schemaVersion: z.number().int(),
  sentAt: z.iso.datetime({ offset: true }),
  writeKey: z.string().min(1).max(200).optional(),
  context: contextSchema.optional(),
  events: z.array(z.unknown()).min(1).max(LIMITS.maxEventsPerBatch),
});

export const ingestResponseSchema = z.object({
  accepted: z.number().int(),
  duplicates: z.number().int(),
  rejected: z.array(
    z.object({ index: z.number().int(), code: z.enum(EVENT_REJECTION_CODES), path: z.string() }),
  ),
  requestId: z.string(),
});

export const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});

export type BatchEnvelope = z.infer<typeof batchEnvelopeSchema>;
export type BatchContext = z.infer<typeof contextSchema>;
export type IngestResponse = z.infer<typeof ingestResponseSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
