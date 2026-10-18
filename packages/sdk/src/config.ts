import { DEFAULT_BATCH_SIZE, MAX_EVENTS_PER_BATCH } from "./limits.js";
import type { AnalyticsError, AnalyticsOptions, SdkEvent, SpaMode } from "./types.js";

// Spec §8.2 defaults. Numbers are clamped to sane ranges instead of throwing.

export interface Config {
  url: string;
  writeKey: string;
  identity: "cookieless" | "persistent";
  requireConsent: boolean;
  respectGpc: boolean;
  respectDnt: boolean;
  trackLocalhost: boolean;
  hostAllowlist: string[] | null;
  pageviews: boolean;
  spa: SpaMode;
  excludePaths: RegExp[];
  flushIntervalMs: number;
  maxBatchSize: number;
  maxQueueSize: number;
  requestTimeoutMs: number;
  maxRetries: number;
  beforeSend: ((event: SdkEvent) => SdkEvent | null) | null;
  failOpen: boolean;
  onError: (error: AnalyticsError) => void;
  debug: boolean;
}

const INGEST_PATH = "/api/v1/ingest/batch";

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** `*` matches inside one path segment, `**` matches across segments. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*\*|\*/g, (m) => (m === "**" ? ".*" : "[^/]*"))}$`);
}

export function resolveConfig(o: AnalyticsOptions): Config {
  if (!o || typeof o.endpoint !== "string" || typeof o.writeKey !== "string" || !o.writeKey) {
    throw new Error("endpoint and writeKey are required");
  }
  return {
    url: o.endpoint.replace(/\/+$/, "") + INGEST_PATH,
    writeKey: o.writeKey,
    identity: o.identity === "persistent" ? "persistent" : "cookieless",
    requireConsent: o.requireConsent === true,
    respectGpc: o.respectGlobalPrivacyControl !== false,
    respectDnt: o.respectDoNotTrack !== false,
    trackLocalhost: o.trackLocalhost === true,
    hostAllowlist: o.hostAllowlist ? o.hostAllowlist.map((h) => h.toLowerCase()) : null,
    pageviews: o.autoCapture?.pageviews !== false,
    spa: o.autoCapture?.spa ?? "auto",
    excludePaths: (o.excludePaths ?? []).map(globToRegExp),
    flushIntervalMs: clamp(o.flushIntervalMs, 5000, 100, 60_000),
    maxBatchSize: clamp(o.maxBatchSize, DEFAULT_BATCH_SIZE, 1, MAX_EVENTS_PER_BATCH),
    maxQueueSize: clamp(o.maxQueueSize, 200, 1, 10_000),
    requestTimeoutMs: clamp(o.requestTimeoutMs, 8000, 1000, 60_000),
    maxRetries: clamp(o.maxRetries, 4, 0, 10),
    beforeSend: o.beforeSend ?? null,
    failOpen: o.failOpen === true,
    onError: o.onError ?? (() => {}),
    debug: o.debug === true,
  };
}
