import { describe, expect, it } from "vitest";
import { batchBody } from "../../test-support/seed-ingest.js";
import { type ResolvedKey, WriteKeyCache } from "../key-cache/write-key-cache.js";
import { IngestDiagnostics, MAX_ORIGINS_PER_DAY } from "./ingest-diagnostics.js";
import { IngestRateLimiter } from "./ingest-rate-limiter.js";
import { readBatchBody, writeKeyOf } from "./read-batch-body.js";
import { validateBatch } from "./validate-batch.js";

const clock = (start = 1_000_000) => {
  const state = { now: start };
  return { state, now: () => state.now };
};
const key = { keyId: "k" } as ResolvedKey;
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code: string }).code;
  }
  return "no error";
};

describe("write key cache (spec §7 step 2)", () => {
  it("keeps known keys 60 s and unknown keys 10 s", () => {
    const c = clock();
    const cache = new WriteKeyCache(c.now);
    cache.set("known", key);
    cache.set("unknown", null);
    c.state.now += 9_999;
    expect(cache.get("known")).toBe(key);
    expect(cache.get("unknown")).toBeNull();
    c.state.now += 1;
    expect(cache.get("unknown")).toBeUndefined();
    c.state.now += 50_000;
    expect(cache.get("known")).toBeUndefined();
  });

  it("forgets only the changed environment's keys", () => {
    const cache = new WriteKeyCache();
    cache.set("a", key);
    cache.set("b", { ...key, environmentId: "other" });
    cache.forgetEnvironment(key.environmentId);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")?.environmentId).toBe("other");
  });
});

describe("ingest rate limiter (spec §7 step 4)", () => {
  it("allows the limit per minute, then answers with the wait in seconds", () => {
    const c = clock();
    const limiter = new IngestRateLimiter(c.now);
    expect([1, 2, 3].map(() => limiter.take("key:a", 3))).toEqual([0, 0, 0]);
    c.state.now += 15_000;
    expect(limiter.take("key:a", 3)).toBe(45);
    expect(limiter.take("ip:a", 3)).toBe(0); // separate bucket
    c.state.now += 45_000;
    expect(limiter.take("key:a", 3)).toBe(0);
  });
});

describe("batch body", () => {
  it("parses text/plain, rejects bad JSON and non-objects", () => {
    expect(readBatchBody('{"a":1}')).toEqual({ a: 1 });
    expect(codeOf(() => readBatchBody("{"))).toBe("INVALID_JSON");
    expect(codeOf(() => readBatchBody("[1]"))).toBe("INVALID_ENVELOPE");
  });

  it("takes the header key before the body key", () => {
    expect(writeKeyOf({ writeKey: "body" }, "header")).toBe("header");
    expect(writeKeyOf({ writeKey: "body" }, undefined)).toBe("body");
    expect(writeKeyOf({ writeKey: 5 }, undefined)).toBeUndefined();
  });
});

describe("batch validation (spec §6.2, §6.3)", () => {
  it("rejects the whole batch for envelope errors", () => {
    const body = batchBody("k");
    const now = Date.now();
    expect(codeOf(() => validateBatch({ ...body, schemaVersion: 2 }, now))).toBe(
      "UNSUPPORTED_SCHEMA_VERSION",
    );
    const big = batchBody("k", Array(51).fill(0));
    expect(codeOf(() => validateBatch(big, now))).toBe("BATCH_TOO_LARGE");
    expect(codeOf(() => validateBatch({ ...body, sentAt: "yesterday" }, now))).toBe(
      "INVALID_ENVELOPE",
    );
    expect(codeOf(() => validateBatch({ ...body, events: [] }, now))).toBe("INVALID_ENVELOPE");
  });

  it("rejects bad events one by one with a path", () => {
    const body = batchBody("k", [0, 0]);
    const [first] = body.events;
    const events = [{ ...first, url: "ftp://x" }, body.events[1]];
    const result = validateBatch({ ...body, events }, Date.now());
    expect(result.rejected).toEqual([{ index: 0, code: "INVALID_EVENT", path: "url" }]);
    expect(result.events.map((e) => e.index)).toEqual([1]);
  });

  it("corrects client clock skew, then applies the future and age limits", () => {
    const now = Date.now();
    const skewed = (clientAhead: number, age: number) => {
      const body = batchBody("k", [age - clientAhead]);
      return validateBatch({ ...body, sentAt: new Date(now + clientAhead).toISOString() }, now);
    };
    // Client clock 1 h fast: an event 10 s old (client time) lands 10 s before server now.
    const ok = skewed(3_600_000, 10_000);
    expect(Math.abs((ok.events[0]?.occurredAt.getTime() ?? 0) - (now - 10_000))).toBeLessThan(50);
    expect(skewed(0, -6 * 60_000).rejected[0]?.code).toBe("EVENT_IN_FUTURE");
    expect(skewed(0, 73 * 3_600_000).rejected[0]?.code).toBe("EVENT_TOO_OLD");
  });
});

describe("ingest diagnostics (spec §7 step 3)", () => {
  it("sums codes per hour and keeps at most 20 distinct origins per day", () => {
    const diagnostics = new IngestDiagnostics(() => Date.parse("2026-10-17T06:23:00Z"));
    const target = { projectId: "p", environmentId: "e" };
    diagnostics.record(target, "ORIGIN_NOT_ALLOWED");
    diagnostics.record(target, "ORIGIN_NOT_ALLOWED", 2);
    for (let i = 0; i < 25; i++) diagnostics.recordOrigin(target, `https://s${i}.example`);
    const drained = diagnostics.drain();
    expect(drained.counters).toEqual([
      { ...target, hour: "2026-10-17T06:00:00.000Z", code: "ORIGIN_NOT_ALLOWED", count: 3 },
    ]);
    expect(drained.origins).toHaveLength(MAX_ORIGINS_PER_DAY);
    expect(diagnostics.drain()).toEqual({ counters: [], origins: [] });
    diagnostics.recordOrigin(target, `https://${"x".repeat(300)}`);
    expect(diagnostics.drain().origins[0]?.origin).toHaveLength(255);
  });
});
