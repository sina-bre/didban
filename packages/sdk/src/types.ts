// Public types. Hand-written (no Zod, ADR 0010); test/contract.test.ts checks them against
// packages/contracts so the two cannot drift.

export type PropertyValue = string | number | boolean | null;
export type Properties = Record<string, PropertyValue>;
export type Consent = "granted" | "denied";
export type SpaMode = "auto" | "history" | "hash" | "off";

export interface SdkEvent {
  eventId: string;
  type: "page" | "track" | "identify";
  name?: string;
  occurredAt: string;
  url: string;
  referrer?: string;
  title?: string;
  anonymousId?: string;
  userId?: string;
  properties: Properties;
}

/** `code` is stable: an ingest error code from the server or one of the SDK codes in docs. */
export type AnalyticsError = Error & { code: string };

export interface AnalyticsOptions {
  /** Collector origin (`https://analytics.example.com`) or a same-origin proxy path (`/a/e`). */
  endpoint: string;
  /** Public browser write key. Never put a server key in a frontend bundle. */
  writeKey: string;
  identity?: "cookieless" | "persistent";
  requireConsent?: boolean;
  respectGlobalPrivacyControl?: boolean;
  respectDoNotTrack?: boolean;
  trackLocalhost?: boolean;
  hostAllowlist?: string[];
  /** Optional modules take their factory instead of `true`, so unused ones cost zero bytes. */
  autoCapture?: {
    pageviews?: boolean;
    spa?: SpaMode;
    outboundLinks?: Module;
    fileDownloads?: Module;
    scrollDepth?: Module;
    engagedTime?: Module;
  };
  /** Glob list matched against the path: `*` stays inside one segment, `**` crosses segments. */
  excludePaths?: string[];
  flushIntervalMs?: number;
  maxBatchSize?: number;
  maxQueueSize?: number;
  requestTimeoutMs?: number;
  maxRetries?: number;
  /** Return `null` to drop the event. */
  beforeSend?: (event: SdkEvent) => SdkEvent | null;
  /** When `beforeSend` throws: `true` sends the event unmodified, `false` (default) drops it. */
  failOpen?: boolean;
  onError?: (error: AnalyticsError) => void;
  debug?: boolean;
}

/** Queues one custom event from a module. `url` defaults to the current page. */
export type ModuleEmit = (event: {
  type: "track";
  name: string;
  properties: Properties;
  url?: string;
}) => void;
/** Adds a listener that `shutdown()` removes. */
export type ModuleOn = (
  target: EventTarget,
  type: string,
  fn: EventListener,
  options?: AddEventListenerOptions,
) => void;
/**
 * An optional auto-capture module (`@didban/analytics/scroll-depth`, …). Runs once when tracking
 * starts and may return a callback that runs before each page view with that page's URL.
 */
export type Module = (emit: ModuleEmit, on: ModuleOn) => ((url: string) => void) | undefined;

export interface Analytics {
  page(properties?: Properties): void;
  track(name: string, properties?: Properties): void;
  identify(userId: string): void;
  reset(): void;
  setConsent(consent: Consent): void;
  optOut(): void;
  optIn(): void;
  flush(): Promise<void>;
  shutdown(): void;
}
