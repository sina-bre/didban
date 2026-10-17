import { describe, expect, it } from "vitest";
import { batchEnvelopeSchema, INGEST_ERRORS, LIMITS } from "../src/index.js";

const envelope = {
  schemaVersion: 1,
  sentAt: "2026-10-17T06:23:10.123Z",
  writeKey: "wk_browser_example",
  context: { sdk: { name: "@didban/analytics", version: "0.1.0" }, screen: { w: 1440, h: 900 } },
  events: [{}],
};

describe("batchEnvelopeSchema", () => {
  it("accepts a valid envelope and leaves events unvalidated for per-event checks", () => {
    expect(batchEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("rejects empty and oversized batches", () => {
    expect(batchEnvelopeSchema.safeParse({ ...envelope, events: [] }).success).toBe(false);
    const events = Array.from({ length: LIMITS.maxEventsPerBatch + 1 }, () => ({}));
    expect(batchEnvelopeSchema.safeParse({ ...envelope, events }).success).toBe(false);
  });

  it("requires an ISO timestamp for sentAt", () => {
    expect(batchEnvelopeSchema.safeParse({ ...envelope, sentAt: "yesterday" }).success).toBe(false);
  });
});

describe("INGEST_ERRORS", () => {
  it("retries only transient failures (spec §6.5)", () => {
    const retryable = Object.entries(INGEST_ERRORS)
      .filter(([, e]) => e.retry)
      .map(([code]) => code);
    expect(retryable.sort()).toEqual(["INTERNAL_ERROR", "RATE_LIMITED", "SERVICE_UNAVAILABLE"]);
  });
});
