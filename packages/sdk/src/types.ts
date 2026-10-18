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
  autoCapture?: { pageviews?: boolean; spa?: SpaMode };
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
