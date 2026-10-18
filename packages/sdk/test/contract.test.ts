import {
  type AnalyticsEvent,
  batchEnvelopeSchema,
  EVENT_NAME_PATTERN,
  eventSchema,
  LIMITS,
  RETRYABLE_HTTP_STATUSES,
  SCHEMA_VERSION,
} from "@didban/contracts";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import pkg from "../package.json" with { type: "json" };
import * as limits from "../src/limits.js";
import { MAX_PROPERTY_STRING_LENGTH } from "../src/modules/property.js";
import { SDK_NAME, SDK_VERSION } from "../src/payload.js";
import type { SdkEvent } from "../src/types.js";
import { cleanup, idle, setup, stubFetch } from "./helpers.js";

// ADR 0010: the SDK has its own types and constants; these tests make drift fail CI.

afterEach(cleanup);

describe("contract", () => {
  it("SDK payloads parse with the real contracts schemas", async () => {
    vi.useFakeTimers();
    const { sent } = stubFetch();
    const analytics = setup({ identity: "persistent" });
    await idle();
    analytics.track("signup_completed", { method: "email", seats: 3, trial: true, ref: null });
    analytics.identify("user_123");
    analytics.track("purchase_completed", { $revenue: 19.99, $currency: "EUR" });
    await analytics.flush();
    const bodies = sent.map((s) => s.body);
    const events = bodies.flatMap((b) => b.events);
    expect(events.map((e) => e.type)).toEqual(["page", "track", "identify", "track"]);
    for (const body of bodies) expect(batchEnvelopeSchema.parse(body)).toBeTruthy();
    for (const event of events) expect(eventSchema.safeParse(event).error).toBeUndefined();
    expect(bodies[0]?.context).toMatchObject({ sdk: { name: SDK_NAME, version: SDK_VERSION } });
  });

  it("SDK event type is assignable to the contracts input type", () => {
    expectTypeOf<SdkEvent>().toExtend<Omit<AnalyticsEvent, "type" | "name">>();
  });

  it("copied constants equal packages/contracts", () => {
    expect(limits.SCHEMA_VERSION).toBe(SCHEMA_VERSION);
    expect(limits.MAX_EVENTS_PER_BATCH).toBe(LIMITS.maxEventsPerBatch);
    expect(limits.DEFAULT_BATCH_SIZE).toBe(LIMITS.sdkDefaultBatchSize);
    expect(limits.MAX_BEACON_BYTES).toBe(LIMITS.maxBeaconBytes);
    expect(limits.MAX_URL_LENGTH).toBe(LIMITS.maxUrlLength);
    expect(limits.MAX_TITLE_LENGTH).toBe(LIMITS.maxTitleLength);
    expect(MAX_PROPERTY_STRING_LENGTH).toBe(LIMITS.maxPropertyStringLength);
    expect(limits.MAX_ID_LENGTH).toBe(LIMITS.maxIdLength);
    expect(limits.EVENT_NAME_PATTERN.source).toBe(EVENT_NAME_PATTERN.source);
    expect(limits.RETRYABLE_HTTP_STATUSES).toEqual([...RETRYABLE_HTTP_STATUSES]);
  });

  it("SDK name and version match package.json", () => {
    expect([SDK_NAME, SDK_VERSION]).toEqual([pkg.name, pkg.version]);
  });
});
