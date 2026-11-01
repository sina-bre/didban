import { describe, expect, it } from "vitest";
import { presetRange, resolveRelativeRange } from "../src/stats-relative.js";

// 2026-03-20 22:30 UTC is already 2026-03-21 in Tehran (+03:30).
const now = new Date("2026-03-20T22:30:00Z");

describe("presetRange", () => {
  it("covers whole days ending today in the zone", () => {
    const range = presetRange("7d", "Asia/Tehran", now);
    expect(range.from.toISOString()).toBe("2026-03-14T20:30:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-21T20:30:00.000Z");
  });

  it("is today alone for `today`, in UTC", () => {
    const range = presetRange("today", "UTC", now);
    expect(range.from.toISOString()).toBe("2026-03-20T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-21T00:00:00.000Z");
  });

  it("keeps local midnights across a DST change", () => {
    const range = presetRange("30d", "Europe/Berlin", new Date("2026-04-02T12:00:00Z"));
    expect(range.from.toISOString()).toBe("2026-03-03T23:00:00.000Z"); // CET
    expect(range.to.toISOString()).toBe("2026-04-02T22:00:00.000Z"); // CEST
  });
});

describe("resolveRelativeRange", () => {
  it("replaces `range` with from/to and keeps the other fields", () => {
    const raw = { range: "today", compare: "previous_period", filter: ["a"] };
    expect(resolveRelativeRange(raw, "UTC", now)).toEqual({
      compare: "previous_period",
      filter: ["a"],
      from: "2026-03-20T00:00:00.000Z",
      to: "2026-03-21T00:00:00.000Z",
    });
  });

  it("leaves a query without `range` alone", () => {
    const raw = { from: "x", to: "y" };
    expect(resolveRelativeRange(raw, "UTC", now)).toBe(raw);
  });

  it("refuses an unknown preset or `range` with from/to", () => {
    expect(resolveRelativeRange({ range: "365d" }, "UTC", now)).toBeNull();
    expect(resolveRelativeRange({ range: "7d", from: "x" }, "UTC", now)).toBeNull();
    expect(resolveRelativeRange({ range: ["7d", "30d"] }, "UTC", now)).toBeNull();
  });
});
