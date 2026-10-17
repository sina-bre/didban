import {
  type AnalyticsEvent,
  type BatchEnvelope,
  batchEnvelopeSchema,
  type EventRejectionCode,
  eventSchema,
  LIMITS,
  SCHEMA_VERSION,
} from "@didban/contracts";
import { ingestError } from "./ingest-error.js";
import type { BatchBody } from "./read-batch-body.js";

// Spec §7 step 5 + §6.3: envelope errors reject the batch; event errors reject only that event.
// `occurredAt` becomes the skew-corrected time: occurredAt + (server now − sentAt).

export type ValidEvent = { index: number; event: AnalyticsEvent; occurredAt: Date };
export type Rejection = { index: number; code: EventRejectionCode; path: string };
export type ValidatedBatch = {
  envelope: BatchEnvelope;
  events: ValidEvent[];
  rejected: Rejection[];
};

const MAX_FUTURE_MS = LIMITS.maxFutureSkewMinutes * 60_000;
const MAX_AGE_MS = LIMITS.maxEventAgeHours * 3_600_000;

function readEnvelope(body: BatchBody): BatchEnvelope {
  if (typeof body.schemaVersion === "number" && body.schemaVersion !== SCHEMA_VERSION) {
    throw ingestError("UNSUPPORTED_SCHEMA_VERSION", `schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (Array.isArray(body.events) && body.events.length > LIMITS.maxEventsPerBatch) {
    throw ingestError("BATCH_TOO_LARGE", `At most ${LIMITS.maxEventsPerBatch} events per batch`);
  }
  const parsed = batchEnvelopeSchema.safeParse(body);
  if (!parsed.success) throw ingestError("INVALID_ENVELOPE", "Invalid batch envelope");
  return parsed.data;
}

function checkEvent(
  raw: unknown,
  index: number,
  offsetMs: number,
  now: number,
): ValidEvent | Rejection {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") ?? "";
    return { index, code: "INVALID_EVENT", path };
  }
  const occurredAt = Date.parse(parsed.data.occurredAt) + offsetMs;
  if (occurredAt > now + MAX_FUTURE_MS) {
    return { index, code: "EVENT_IN_FUTURE", path: "occurredAt" };
  }
  if (occurredAt < now - MAX_AGE_MS) {
    return { index, code: "EVENT_TOO_OLD", path: "occurredAt" };
  }
  return { index, event: parsed.data, occurredAt: new Date(occurredAt) };
}

export function validateBatch(body: BatchBody, now: number): ValidatedBatch {
  const envelope = readEnvelope(body);
  const offsetMs = now - Date.parse(envelope.sentAt);
  const events: ValidEvent[] = [];
  const rejected: Rejection[] = [];
  envelope.events.forEach((raw, index) => {
    const result = checkEvent(raw, index, offsetMs, now);
    if ("code" in result) rejected.push(result);
    else events.push(result);
  });
  return { envelope, events, rejected };
}
