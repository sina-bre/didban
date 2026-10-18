import { RETRYABLE_HTTP_STATUSES } from "./limits.js";

// Spec §6.5 retry table + §8.2 backoff (full jitter, base 1 s, cap 30 s).

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 30_000;
/** A `Retry-After` longer than this drops the batch instead of holding it in the tab. */
export const MAX_RETRY_AFTER_MS = 60_000;

export interface HttpResult {
  status: number;
  code?: string;
  retryAfterMs: number | null;
  rejected: number;
}

export type Outcome =
  | { kind: "ok" }
  | { kind: "retry"; delayMs?: number }
  | { kind: "split" }
  | { kind: "drop"; code: string };

/** Delay before retry number `attempt` (0-based): uniform in [0, min(cap, base * 2^attempt)). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  return Math.floor(random() * Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt));
}

/** `Retry-After` is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (value.trim() !== "" && Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * The HTTP status decides, except QUOTA_EXCEEDED (a 429 that is not retried until the next quota
 * window). test/retry.test.ts checks this rule against every code in INGEST_ERRORS, so the SDK
 * does not ship the whole table.
 */
export function isRetryable(result: Pick<HttpResult, "status" | "code">): boolean {
  if (result.code === "QUOTA_EXCEEDED") return false;
  return RETRYABLE_HTTP_STATUSES.includes(result.status);
}

/** `null` = network error or timeout, which is retried. */
export function classify(result: HttpResult | null): Outcome {
  if (!result) return { kind: "retry" };
  if (result.status >= 200 && result.status < 300) return { kind: "ok" };
  if (result.status === 413) return { kind: "split" };
  const code = result.code ?? `HTTP_${result.status}`;
  if (!isRetryable(result)) return { kind: "drop", code };
  const wait = result.retryAfterMs;
  if (wait === null) return { kind: "retry" };
  return wait > MAX_RETRY_AFTER_MS ? { kind: "drop", code } : { kind: "retry", delayMs: wait };
}
