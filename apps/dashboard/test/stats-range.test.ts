import { describe, expect, it } from "vitest";
import { statsRange } from "../src/shared/lib/stats-range";

// Days are the project's reporting days, whatever zone the browser is in.
const params = (search: string) => new URLSearchParams(search);

describe("statsRange", () => {
  // 2026-10-26 01:30 UTC = 26 Oct 05:00 in Tehran (+03:30), still 25 Oct 21:30 in New York.
  const now = new Date(Date.UTC(2026, 9, 26, 1, 30));

  it("presets go to the API as `range` (it resolves them in the project's zone, ADR 0046)", () => {
    expect(statsRange(params("range=7d"), "Asia/Tehran", now)).toEqual({ range: "7d" });
    expect(statsRange(params("range=today"), "America/New_York", now)).toEqual({ range: "today" });
    expect(statsRange(params(""), "UTC", now)).toEqual({ range: "30d" });
    expect(statsRange(params("range=365d"), "UTC", now)).toEqual({ range: "30d" });
  });

  it("a custom range covers its first day through the end of its last day", () => {
    expect(statsRange(params("from=2026-10-01&to=2026-10-03"), "Europe/Berlin", now)).toEqual({
      from: "2026-09-30T22:00:00.000Z",
      to: "2026-10-03T22:00:00.000Z",
    });
  });

  it("a day with a DST change is 25 hours long, not 24", () => {
    const range = statsRange(params("from=2026-10-25&to=2026-10-25"), "Europe/Berlin", now);
    const { from, to } = range as { from: string; to: string };
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(25);
  });
});
