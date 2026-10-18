import { describe, expect, it } from "vitest";
import { statsQuerySchema } from "../src/stats.js";
import {
  devicesQuerySchema,
  eventPropertiesQuerySchema,
  geoQuerySchema,
  pagesQuerySchema,
  sourcesQuerySchema,
} from "../src/stats-breakdowns.js";
import { formatFilter, parseFilter } from "../src/stats-filters.js";

const range = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" };

describe("parseFilter", () => {
  it("parses allowlisted fields, ops, `in` lists and property keys", () => {
    expect(parseFilter("pathname:eq:/pricing")).toEqual({
      field: "pathname",
      op: "eq",
      values: ["/pricing"],
    });
    expect(parseFilter("country:in:DE|FR")?.values).toEqual(["DE", "FR"]);
    expect(parseFilter("prop.plan:eq:pro:annual")?.values).toEqual(["pro:annual"]);
    expect(formatFilter({ field: "os", op: "in", values: ["iOS", "Android"] })).toBe(
      "os:in:iOS|Android",
    );
  });

  it("rejects unknown fields and ops, bad property keys and empty values", () => {
    for (const raw of [
      "password_hash:eq:x",
      "pathname:like:/a",
      "prop.1bad:eq:x",
      "prop.a;drop:eq:x",
      "pathname:eq:",
      "country:in:DE||FR",
      "pathname",
      `pathname:eq:${"a".repeat(256)}`,
    ]) {
      expect(parseFilter(raw), raw).toBeNull();
    }
  });
});

describe("statsQuerySchema", () => {
  it("applies defaults and turns one filter into a list", () => {
    const q = statsQuerySchema.parse({ ...range, filter: "browser:eq:Chrome" });
    expect(q.interval).toBe("auto");
    expect(q.compare).toBe("none");
    expect(q.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(q.filter).toHaveLength(1);
  });

  it("rejects reversed or empty ranges, > 366 days, offsets, > 10 or bad filters", () => {
    const bad = [
      { from: range.to, to: range.from },
      { from: range.from, to: range.from },
      { from: "2025-01-01T00:00:00Z", to: "2026-01-03T00:00:00Z" },
      { from: "2026-10-01T00:00:00+02:00", to: range.to },
      { ...range, filter: Array.from({ length: 11 }, () => "os:eq:iOS") },
      { ...range, filter: ["os:eq:iOS", "nope:eq:x"] },
      { ...range, interval: "minute" },
    ];
    for (const input of bad) expect(statsQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe("breakdown query schemas", () => {
  it("default limit 10, max 100, enum dimensions, property key pattern", () => {
    const pages = pagesQuerySchema.parse({ ...range });
    expect([pages.limit, pages.view]).toEqual([10, "top"]);
    expect(sourcesQuerySchema.parse({ ...range, limit: "100", by: "utm_campaign" }).limit).toBe(
      100,
    );
    expect(sourcesQuerySchema.safeParse({ ...range, limit: "101" }).success).toBe(false);
    expect(devicesQuerySchema.safeParse({ ...range, by: "password_hash" }).success).toBe(false);
    expect(eventPropertiesQuerySchema.safeParse({ ...range, key: "a;b" }).success).toBe(false);
    expect(geoQuerySchema.safeParse({ from: range.to, to: range.from }).success).toBe(false);
  });
});
