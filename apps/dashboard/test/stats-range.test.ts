import { describe, expect, it } from "vitest";
import { statsRange } from "../src/shared/lib/stats-range";

// Days are the project's reporting days, whatever zone the browser is in.
const params = (search: string) => new URLSearchParams(search);

describe("statsRange", () => {
  // 2026-10-26 01:30 UTC = 26 Oct 05:00 in Tehran (+03:30), still 25 Oct 21:30 in New York.
  const now = new Date(Date.UTC(2026, 9, 26, 1, 30));

  it("presets are whole reporting days ending with today, in the project's zone", () => {
    expect(statsRange(params("range=7d"), "Asia/Tehran", now)).toEqual({
      from: "2026-10-19T20:30:00.000Z",
      to: "2026-10-26T20:30:00.000Z",
    });
    expect(statsRange(params("range=today"), "America/New_York", now)).toEqual({
      from: "2026-10-25T04:00:00.000Z",
      to: "2026-10-26T04:00:00.000Z",
    });
  });

  it("defaults to 30 days and stays the same within a day (stable cache key)", () => {
    const later = new Date(Date.UTC(2026, 9, 26, 19, 0));
    expect(statsRange(params(""), "UTC", now)).toEqual(statsRange(params(""), "UTC", later));
    expect(statsRange(params(""), "UTC", now).from).toBe("2026-09-27T00:00:00.000Z");
  });

  it("a custom range covers its first day through the end of its last day", () => {
    expect(statsRange(params("from=2026-10-01&to=2026-10-03"), "Europe/Berlin", now)).toEqual({
      from: "2026-09-30T22:00:00.000Z",
      to: "2026-10-03T22:00:00.000Z",
    });
  });

  it("a day with a DST change is 25 hours long, not 24", () => {
    const { from, to } = statsRange(params("from=2026-10-25&to=2026-10-25"), "Europe/Berlin", now);
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(25);
  });
});
