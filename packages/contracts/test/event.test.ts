import { describe, expect, it } from "vitest";
import { eventSchema } from "../src/index.js";

const page = {
  eventId: "0192f3a0-7b1c-7c3e-9f10-2a4d5e6f7a81",
  type: "page",
  occurredAt: "2026-10-17T06:23:09.870Z",
  url: "https://app.example.com/pricing?utm_source=news",
  referrer: "https://www.google.com/",
  title: "Pricing",
};
const track = { ...page, type: "track", name: "signup_completed", properties: { plan: "pro" } };

const ok = (input: unknown) => eventSchema.safeParse(input).success;

describe("eventSchema", () => {
  it("accepts the spec example page and track events", () => {
    expect(ok(page)).toBe(true);
    expect(ok(track)).toBe(true);
  });

  it("defaults properties to an empty object and strips unknown fields", () => {
    const parsed = eventSchema.parse({ ...page, projectId: "spoofed", extra: 1 });
    expect(parsed.properties).toEqual({});
    expect(parsed).not.toHaveProperty("projectId");
    expect(parsed).not.toHaveProperty("extra");
  });

  it("accepts ULIDs and rejects UUID v4 event ids", () => {
    expect(ok({ ...page, eventId: "01JABCDEF0123456789ABCDEFG" })).toBe(true);
    expect(ok({ ...page, eventId: "9b2f6c1e-4b1d-4c3e-9f10-2a4d5e6f7a81" })).toBe(false);
  });

  it("rejects non-http urls and over-long urls", () => {
    expect(ok({ ...page, url: "ftp://example.com/file" })).toBe(false);
    expect(ok({ ...page, url: "javascript:alert(1)" })).toBe(false);
    expect(ok({ ...page, url: `https://example.com/${"a".repeat(2100)}` })).toBe(false);
  });

  it("validates event names", () => {
    expect(ok({ ...track, name: "checkout:step-2.done" })).toBe(true);
    expect(ok({ ...track, name: "$pageview" })).toBe(false);
    expect(ok({ ...track, name: "1st" })).toBe(false);
    expect(ok({ ...track, name: "a".repeat(65) })).toBe(false);
  });

  it("requires userId on identify events", () => {
    expect(ok({ ...page, type: "identify" })).toBe(false);
    expect(ok({ ...page, type: "identify", userId: "user_123" })).toBe(true);
  });

  it("rejects events larger than 8 KB", () => {
    const properties = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`k${i}`, "x".repeat(255)]),
    );
    expect(ok({ ...track, properties, title: "t".repeat(300) })).toBe(true);
    const big = {
      ...track,
      properties,
      title: "t".repeat(300),
      url: `${page.url}&${"q".repeat(1900)}`,
    };
    expect(ok({ ...big, referrer: `https://r.example/${"r".repeat(1900)}` })).toBe(false);
  });
});
