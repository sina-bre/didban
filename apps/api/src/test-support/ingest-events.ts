import { uuidV7 } from "../domain/uuid-v7.js";
import { BROWSER_UA, SITE } from "./seed-ingest.js";
import type { startTestApp } from "./test-app.js";

type App = Awaited<ReturnType<typeof startTestApp>>;
type Event = Record<string, unknown>;

/** A page view with a fresh UUIDv7, `ageMs` before now (overrides win). */
export function page(path: string, ageMs = 0, overrides: Event = {}): Event {
  const at = Date.now() - ageMs;
  return {
    eventId: uuidV7(at),
    type: "page",
    occurredAt: new Date(at).toISOString(),
    url: `${SITE}${path}`,
    ...overrides,
  };
}

export const track = (name: string, ageMs = 0, overrides: Event = {}) =>
  page("/", ageMs, { type: "track", name, ...overrides });

export type SendOptions = { server?: boolean; ip?: string; userAgent?: string; sentAt?: string };

/** Posts events the way the SDK does (browser) or a backend does (server key in a header). */
export function sendEvents(t: App, key: string, events: Event[], options: SendOptions = {}) {
  const body = { schemaVersion: 1, sentAt: options.sentAt ?? new Date().toISOString(), events };
  const headers: Record<string, string> = options.server
    ? { "content-type": "application/json", "x-write-key": key }
    : { "content-type": "text/plain", origin: SITE, "user-agent": options.userAgent ?? BROWSER_UA };
  return t.send({
    method: "POST",
    url: "/api/v1/ingest/batch",
    payload: JSON.stringify(options.server ? body : { ...body, writeKey: key }),
    headers,
    remoteAddress: options.ip ?? "198.51.100.7",
  });
}
