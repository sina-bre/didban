import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { storedEvents } from "./db.js";
import { API_URL, PROJECTS, SERVER_KEY } from "./keys.js";

// Stage 3 gate: a server event with $revenue/$currency (docs/integration.md) lands in PostgreSQL,
// and a retry with the same eventId is a duplicate, not a second row.

/** UUIDv7: 48-bit ms timestamp, version and variant bits, random rest. */
function uuidv7(): string {
  const hex = Date.now().toString(16).padStart(12, "0") + randomBytes(10).toString("hex");
  const variant = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const v = `${hex.slice(0, 12)}7${hex.slice(13, 16)}${variant}${hex.slice(17, 32)}`;
  return v.replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
}

test("server event with revenue lands once, retry counts as duplicate", async ({ request }) => {
  const since = new Date();
  const event = {
    eventId: uuidv7(),
    type: "track",
    name: "purchase_completed",
    occurredAt: new Date().toISOString(),
    url: "https://shop.example/checkout",
    userId: "user-42",
    properties: { $revenue: 49.9, $currency: "EUR" },
  };
  const send = () =>
    request.post(`${API_URL}/api/v1/ingest/batch`, {
      headers: { "content-type": "application/json", "x-write-key": SERVER_KEY },
      data: { schemaVersion: 1, sentAt: new Date().toISOString(), events: [event] },
    });
  const first = await send();
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ accepted: 1, duplicates: 0, rejected: [] });
  const retry = await send();
  expect(await retry.json()).toMatchObject({ accepted: 0, duplicates: 1 });

  const stored = await storedEvents(PROJECTS.next.slug, since);
  expect(stored.filter((e) => e.name === "purchase_completed")).toEqual([
    {
      type: 2,
      name: "purchase_completed",
      pathname: "/checkout",
      source: 2,
      visitId: null,
      revenue: "49.90",
      currency: "EUR",
    },
  ]);
});
