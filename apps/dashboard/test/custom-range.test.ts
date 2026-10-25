import { describe, expect, it } from "vitest";
import { customBounds, isoDay, readCustomRange } from "../src/shared/lib/url-state";

const now = new Date(2026, 9, 25, 12, 0);
const read = (query: string) => readCustomRange(new URLSearchParams(query), now);

describe("readCustomRange", () => {
  it("reads two real days in order", () => {
    expect(read("from=2026-10-01&to=2026-10-10")).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    expect(read("from=2026-10-25&to=2026-10-25")).toEqual({ from: "2026-10-25", to: "2026-10-25" });
  });

  it("rejects missing, malformed and impossible days", () => {
    expect(read("from=2026-10-01")).toBeNull();
    expect(read("from=2026-10-1&to=2026-10-10")).toBeNull();
    expect(read("from=2026-02-30&to=2026-03-02")).toBeNull();
    expect(read("from=x&to=2026-10-10")).toBeNull();
  });

  it("rejects reversed ranges and future days", () => {
    expect(read("from=2026-10-10&to=2026-10-01")).toBeNull();
    expect(read("from=2026-10-20&to=2026-10-26")).toBeNull();
  });

  it("allows at most 366 days, like the API", () => {
    expect(read("from=2025-10-25&to=2026-10-25")).not.toBeNull(); // 366 days inclusive
    expect(read("from=2025-10-24&to=2026-10-25")).toBeNull();
  });
});

describe("customBounds", () => {
  it("covers the first day from midnight to the end of the last day", () => {
    const { from, to } = customBounds({ from: "2026-10-01", to: "2026-10-10" });
    expect(from).toEqual(new Date(2026, 9, 1, 0, 0));
    expect(to).toEqual(new Date(2026, 9, 10, 23, 59, 59, 999));
  });

  it("isoDay uses the local calendar day", () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
