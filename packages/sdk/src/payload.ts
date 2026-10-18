import { SCHEMA_VERSION } from "./limits.js";
import type { SdkEvent } from "./types.js";

export const SDK_NAME = "@didban/analytics";
export const SDK_VERSION = "0.1.0";

interface BatchContext {
  sdk: { name: string; version: string };
  locale?: string;
  screen?: { w: number; h: number };
  timezone?: string;
}

let context: BatchContext | undefined;

const side = (n: number) => Math.min(20_000, Math.max(0, Math.round(n) || 0));

/** Read once, at the first send (never at import or in `createAnalytics`). */
function readContext(): BatchContext {
  const out: BatchContext = { sdk: { name: SDK_NAME, version: SDK_VERSION } };
  try {
    if (navigator.language) out.locale = navigator.language.slice(0, 35);
    if (window.screen) out.screen = { w: side(screen.width), h: side(screen.height) };
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) out.timezone = zone.slice(0, 64);
  } catch {
    // Context is optional; send the SDK name alone.
  }
  return out;
}

/**
 * Batch body (spec §6.1). Built per attempt so `sentAt` is fresh on every retry (§6.3). The write
 * key goes in the body: the request stays CORS-simple (`text/plain`) and works with sendBeacon.
 */
export function buildPayload(writeKey: string, events: SdkEvent[]): string {
  context ??= readContext();
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    sentAt: new Date().toISOString(),
    writeKey,
    context,
    events,
  });
}
