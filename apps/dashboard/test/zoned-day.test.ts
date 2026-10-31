import { describe, expect, it } from "vitest";
import { addDays, dayIn, parseDay, startOf } from "../src/shared/lib/zoned-day";

// The Intl replacement for @internationalized/date on the report path (Stage 5f).
const start = (iso: string, zone: string) => startOf(parseDay(iso), zone).toISOString();

describe("zoned days", () => {
  it("finds the day an instant falls on in the zone, not in UTC", () => {
    const instant = new Date("2026-10-30T22:30:00Z");
    expect(dayIn(instant, "UTC")).toBe(parseDay("2026-10-30"));
    expect(dayIn(instant, "Asia/Tehran")).toBe(parseDay("2026-10-31")); // +03:30
    expect(dayIn(instant, "America/Los_Angeles")).toBe(parseDay("2026-10-30"));
  });

  it("starts a day at local midnight, half-hour and negative offsets too", () => {
    expect(start("2026-10-31", "Asia/Tehran")).toBe("2026-10-30T20:30:00.000Z");
    expect(start("2026-10-31", "America/Los_Angeles")).toBe("2026-10-31T07:00:00.000Z");
    expect(start("2026-03-29", "Europe/Berlin")).toBe("2026-03-28T23:00:00.000Z");
    expect(start("2026-03-30", "Europe/Berlin")).toBe("2026-03-29T22:00:00.000Z");
  });

  it("a midnight that DST skips starts the day when the gap ends (Santiago 2022-09-11)", () => {
    expect(start("2022-09-11", "America/Santiago")).toBe("2022-09-11T04:00:00.000Z"); // 01:00 -03
  });

  it("adds days as calendar days", () => {
    expect(addDays(parseDay("2026-12-31"), 1)).toBe(parseDay("2027-01-01"));
    expect(addDays(parseDay("2026-03-01"), -1)).toBe(parseDay("2026-02-28"));
  });
});
