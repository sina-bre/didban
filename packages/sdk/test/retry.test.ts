import { INGEST_ERRORS } from "@didban/contracts";
import { describe, expect, it } from "vitest";
import {
  BACKOFF_CAP_MS,
  backoffDelay,
  classify,
  isRetryable,
  MAX_RETRY_AFTER_MS,
  parseRetryAfter,
} from "../src/retry.js";

const result = (status: number, code?: string, retryAfterMs: number | null = null) => ({
  status,
  ...(code ? { code } : {}),
  retryAfterMs,
  rejected: 0,
});

describe("backoffDelay (full jitter, base 1 s, cap 30 s)", () => {
  it("stays inside [0, min(cap, base * 2^attempt))", () => {
    expect(backoffDelay(0, () => 0)).toBe(0);
    expect(backoffDelay(0, () => 0.999)).toBe(999);
    expect(backoffDelay(3, () => 0.5)).toBe(4000);
    expect(backoffDelay(10, () => 0.999)).toBeLessThan(BACKOFF_CAP_MS);
    for (let attempt = 0; attempt < 8; attempt++) {
      const delay = backoffDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(Math.min(BACKOFF_CAP_MS, 1000 * 2 ** attempt));
    }
  });
});

describe("parseRetryAfter", () => {
  it("reads delta-seconds and HTTP dates", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:10 GMT", Date.UTC(2026, 0, 1))).toBe(10_000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
  });
});

describe("classify", () => {
  it("maps statuses to ok / split / retry / drop", () => {
    expect(classify(result(200))).toEqual({ kind: "ok" });
    expect(classify(result(413, "PAYLOAD_TOO_LARGE"))).toEqual({ kind: "split" });
    expect(classify(null)).toEqual({ kind: "retry" });
    expect(classify(result(502))).toEqual({ kind: "retry" });
    expect(classify(result(408))).toEqual({ kind: "retry" });
    expect(classify(result(401, "INVALID_WRITE_KEY"))).toEqual({
      kind: "drop",
      code: "INVALID_WRITE_KEY",
    });
    expect(classify(result(404))).toEqual({ kind: "drop", code: "HTTP_404" });
  });

  it("honours Retry-After on 429 and drops when it is too long", () => {
    expect(classify(result(429, "RATE_LIMITED", 5000))).toEqual({ kind: "retry", delayMs: 5000 });
    expect(classify(result(429, "RATE_LIMITED", MAX_RETRY_AFTER_MS + 1))).toEqual({
      kind: "drop",
      code: "RATE_LIMITED",
    });
    expect(classify(result(429, "QUOTA_EXCEEDED", 1000))).toEqual({
      kind: "drop",
      code: "QUOTA_EXCEEDED",
    });
  });

  it("agrees with the contracts retry flag for every ingest error code", () => {
    for (const [code, { status, retry }] of Object.entries(INGEST_ERRORS)) {
      expect(isRetryable({ status, code }), code).toBe(retry);
    }
  });
});
