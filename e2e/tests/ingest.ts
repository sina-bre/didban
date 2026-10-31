import { randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { API_URL, PROJECTS } from "./keys.js";

// Browser events for the dashboard specs, sent like the SDK does (text/plain body with the write
// key, the example's Origin), so the reports have real rows.

/** UUIDv7: 48-bit ms timestamp, version and variant bits, random rest. */
export function uuidv7(): string {
  const hex = Date.now().toString(16).padStart(12, "0") + randomBytes(10).toString("hex");
  const variant = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const v = `${hex.slice(0, 12)}7${hex.slice(13, 16)}${variant}${hex.slice(17, 32)}`;
  return v.replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
}

type Event = { type: "page" | "track"; path: string; name?: string; props?: object };

/** One batch of browser events on the Vite example's project, one visitor, all now. */
export function sendBrowserEvents(request: APIRequestContext, events: Event[]) {
  return sendEvents(request, { ...PROJECTS.vite, events });
}

/** One batch with any browser write key from any Origin (the wizard's new key, a wrong site). */
export async function sendEvents(
  request: APIRequestContext,
  { key, origin, events }: { key: string; origin: string; events: Event[] },
) {
  const anonymousId = `e2e-${randomBytes(6).toString("hex")}`;
  const body = {
    schemaVersion: 1,
    sentAt: new Date().toISOString(),
    writeKey: key,
    context: { locale: "de-DE", screen: { w: 1280, h: 800 }, timezone: "Europe/Berlin" },
    events: events.map((e) => ({
      eventId: uuidv7(),
      type: e.type,
      occurredAt: new Date().toISOString(),
      url: `${origin}${e.path}`,
      referrer: "https://news.example/today",
      title: `E2E ${e.path}`,
      anonymousId,
      ...(e.name ? { name: e.name } : {}),
      properties: e.props ?? {},
    })),
  };
  const response = await request.post(`${API_URL}/api/v1/ingest/batch`, {
    headers: { "content-type": "text/plain", origin },
    data: JSON.stringify(body),
  });
  return { status: response.status(), json: await response.json() };
}
